
// PART 1: get all gsuite under /individuals, and for each one make a query to core

const gsuite_obj = [
  // {
  //   "primaryEmail": name.surname@aegee.eu, // from gsuite
  //   "recoveryEmail": name.surname@gmail.com, // from gsuite
  //   "g_surname": item.name.familyName, // surname coming from gsuite
  //   "m_possible_users": [], // heuristic of people with the same surname in myaegee
  //   "allocated": false, // whether we have found this person on myaegee
  // } ;
];

//GAM tells me there are 800-900 users, so we need two invocations.

const superagent = require('superagent');

(async () => {

  try{

    const part1 = await superagent.get('gsuite-wrapper:8084/accounts?max=500')

    const part2 = await superagent.get('gsuite-wrapper:8084/accounts?max=500&pageToken='+part1.body.data.nextPageToken)

    let unrecovery=0

    part1.body.data.users.concat(part2.body.data.users).forEach( (item) => {
      gsuite_obj.push(
      {
        "primaryEmail": item.primaryEmail,
        "recoveryEmail": item.recoveryEmail || item.emails[0].address,
        "g_surname": item.name.familyName,
        "m_possible_users": [],
        "allocated": false
      }) ;

      unrecovery += item.recoveryEmail ? 0 : 1 ;

    });

    //double check
    let unsecondary=0
    gsuite_obj.filter(obj => obj.recoveryEmail==='').forEach( obj => { unsecondary +=1; console.log(obj.primaryEmail+" has no secondary email!") } );
    console.log("There are "+unrecovery+" users without a proper recovery email, only secondary; and without secondary are "+unsecondary)
  }catch (e){
    console.log(e)
  }
})();

async function findMyAEGEEuser(obj) {

  const users = await User.findAll({
    where: { email: obj.recoveryEmail.toLowerCase() }
  });

//PART 2: if there is a match, add their gsuite address in the core's field and mark it done
  if(users.length === 1 ){
    try{
      const wow = await User.update({
        gsuite_id: obj.primaryEmail
      },
      {
        where: { email: obj.recoveryEmail.toLowerCase() },
        returning: true,
        plain: true
      });

      obj.allocated=true
    }catch (e){
      console.log(e)
    }
  }
}

gsuite_obj.forEach( findMyAEGEEuser )

//PART 3: now look at groups
//to be implemented (circles are hard, and gsuite matches circle<->group arent mapped yet)
function putInGsuiteGroups(obj) {
  return "wip"

  /* For each circle which has a gsuite_id field set,
   * take a list of members.
   * For each member, execute API call.
   *
   *
   * Blocked by policy (about people 'consenting' to receive mandatory email)
   */

  if(obj.allocated){

    const result = core.query(obj.recoveryEmail).bodies
    const users = await User.findAll({// FIXME or bodies?
      where: { gsuite_id: obj.primaryEmail }
    });

    if(users){
      for (const grp of result.gsuite_id) { //FIXME there must already be a mapping in core between body and gsuite
        const data = {
          "primaryEmail": obj.primaryEmail,
          "group": grp
        }
        runGsuiteOperation(gsuiteOperations.addUserInGroup, data);
        sleep(2) ; //rate limiting
      }
    }
  }
}

//gsuite_obj.forEach( putInGsuiteGroups )

// HERE is the part where we do the MANUAL PATCH
console.log("")
console.log("")
gsuite_obj.filter(obj => obj.allocated===false).forEach( obj => console.log(`${obj.primaryEmail}'s secondary email on my aegee is not ${obj.recoveryEmail}`)) ;
console.log("")
console.log("Total number of unallocated objects:")
console.log(gsuite_obj.filter(obj => obj.allocated===false).length)

//HELPER For our manual patch: heuristic by surname
async function findMyAEGEEuserBySurname(obj) {

  const users = await User.findAll({
    where: { last_name: obj.g_surname } //FIXME use "like"
  });

  console.log(users)

//try match via surname
  if(users.length > 0 ){

    obj.m_possible_users = users
    obj.allocated=true

  }else{ //for our hungarian people or the others...
    const users = await User.findAll({
      where: { first_name: obj.g_surname } //FIXME use "like"
    });
    console.log(users)

    //try match via surname
    if(users.length > 0 ){

      obj.m_possible_users = users
      obj.allocated=true

    }
  }
}

gsuite_obj.filter(obj => obj.allocated===false).forEach( findMyAEGEEuserBySurname )
console.log("")
console.log("")
console.log("heuristic: surname checking")

console.log("easy guess (only one possibility):")
gsuite_obj.filter(obj => obj.m_possible_users.length===1).forEach( obj => { console.log(`${obj.primaryEmail} could be the following: ${obj.m_possible_users}`) ; console.log(obj.m_possible_users[0]) }) ;
console.log("easy guess total: ", gsuite_obj.filter(obj => obj.m_possible_users.length===1).length)

console.log("harder guess")
gsuite_obj.filter(obj => obj.m_possible_users.length>1).forEach( obj => { console.log(`${obj.primaryEmail} could be the following: ${obj.m_possible_users}`) ; console.log(obj.m_possible_users[0]) }) ;
console.log("harder guess total: ", gsuite_obj.filter(obj => obj.m_possible_users.length>1).length)

console.log("")
console.log("")


//LAST PART: create gsuite account for all members in MyAEGEE
// THIS PART NEEDS TO BE LAUNCHED AFTER THE MANUAL PATCH
const users = async function () {
  return await User.findAll({
    where: { gsuite_id: null }
  });
}();

const creationErrors = [];

async function createOneForThesePoorGuys(user) {
  try{
    console.log(`User ${user.email}, creating an account`);

    const regex = / /g;
    const username = (user.first_name+"."+user.last_name).replace(regex, ''); // FIXME also careful of ü ö etc
    const res = await superagent.get('gsuite-wrapper:8084/accounts?q='+username); //check collision

    if (!res.body.data.users){ // then there's no collision and i can post

      const payload = {
        "name": {
          "givenName": user.first_name,
          "familyName": user.last_name
        },
        "primaryEmail": username+"@aegee.eu",
        "secondaryEmail": user.email,
        "password": "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8",
        "antenna": user.primaryBody
      }

      const creation = await superagent.post('gsuite-wrapper:8084/accounts', payload)
      if (!creation.body.success){
        creationErrors.push(creation.body);
      }
      sleep(2) ; //rate limiting
    }
  }catch(e){
    console.log(e)
  }
}

users.forEach( createOneForThesePoorGuys );

// another manual check about creationErrors
console.log("There were "+creationErrors.length+" creation errors")
console.log(creationErrors)

//TODO last but not least: create a final check that says "this gsuite user does not have an equivalent in myaegee"
// the above is a nice to have. Basically the dream script is as below

/*
script that foreach user in gsuite
  1 removes the user's any permission/group
  2 queries myaegee for the data to be provisioned:
    a personal data
    b antenna
    c bodies
    note: gsuite provides the gsuite ID, core
    only replies with the GSUITE-related info e.g. the
    GSUITE id of a group, not the id of a circle!
    things need to be mapped
  3 adds department/cost centre as antenna/body
  4 adds groups as bodies
*/
