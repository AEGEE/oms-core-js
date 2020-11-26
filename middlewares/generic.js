const moment = require('moment');

const errors = require('../lib/errors');
const logger = require('../lib/logger');
const {
    User,
    AccessToken,
    Circle,
    Body,
    BodyMembership,
    JoinRequest,
} = require('../models');
const packageInfo = require('../package');
const PermissionManager = require('../lib/permissions-manager');

exports.maybeAuthorize = async (req, res, next) => {
    const authToken = req.headers['x-auth-token'];
    if (!authToken) {
        return next();
    }

    const accessToken = await AccessToken.findOne({
        where: {
            value: authToken,
        },
        include: [{
            model: User,
            include: [
                { model: Body, as: 'bodies' },
                { model: Body, as: 'primary_body' },
                { model: BodyMembership, as: 'body_memberships' },
                { model: JoinRequest, as: 'join_requests' },
                { model: Circle, as: 'circles' }
            ]
        }]
    });

    if (!accessToken) {
        return next();
    }

    if (moment(accessToken.expires_at).isBefore(moment())) {
        logger.debug('Access token is expired');
        return next();
    }

    req.user = accessToken.user;

    const circles = await Circle.findAll({ fields: ['id', 'parent_circle_id', 'body_id'] });

    req.permissions = new PermissionManager({ user: req.user });
    req.permissions.addCircles(circles);

    await req.permissions.fetchCurrentUserPermissions();

    await req.user.update({ last_active: new Date() });

    return next();
};

exports.ensureAuthorized = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'You are not authorized.'
        });
    }

    return next();
};

/* istanbul ignore next */
exports.healthcheck = (req, res) => {
    return res.json({
        success: true,
        data: {
            name: packageInfo.name,
            description: packageInfo.description,
            version: packageInfo.version
        }
    });
};

/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // Handling validation errors
    /* istanbul ignore else */
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

    /* istanbul ignore next */
    logger.error({ err }, 'Request error');
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};

/// ///////////////////////////////////////////////////////////
// GENERIC SWAGGER DEFINITION: 'tags' and example responses
/**
 * @swagger
 *
 * tags:
 *   - name: "Members"
 *     description: "Accounts operations: add/remove user; modify user details; add/remove aliases for user email"
 *     externalDocs:
 *       description: "?"
 *       url: "https://my.aegee.eu"
 *   - name: "Bodies"
 *     description: "Bodies operations: add/remove a body; add/remove a user membership to a body"
 *     externalDocs:
 *       description: "??"
 *       url: "https://my.aegee.eu"
 *   - name: "Circles"
 *     description: "Circles operations: add "
 *     externalDocs:
 *       description: "???"
 *       url: "https://my.aegee.eu"
 *   - name: "Permissions"
 *     description: "Permissions operations: add "
 *     externalDocs:
 *       description: "???"
 *       url: "https://my.aegee.eu"
 *   - name: "Campaigns"
 *     description: "Campaigns operations: add "
 *     externalDocs:
 *       description: "???"
 *       url: "https://my.aegee.eu"
 *
 * definitions:
 *   generalResponse:
 *     type: object
 *     required:
 *       - success
 *       - message
 *     properties:
 *       success:
 *         type: boolean
 *       message:
 *         type: string
 *
 *   errorResponse:
 *     allOf:
 *       - '$ref': '#/definitions/generalResponse'
 *       - type: object
 *         required:
 *           - error
 *         properties:
 *           error:
 *             type: string
 *
 *
 *   successResponse:
 *     allOf:
 *       - '$ref': '#/definitions/generalResponse'
 *       - type: object
 *         required:
 *           - data
 *         properties:
 *           data:
 *             type: object
 *             example:
 *               "<property>": "<the whole object has all the properties being the name of the db fields>"
 *
 *   Group:
 *     type: "object"
 *     properties:
 *       primaryEmail:
 *         type: "string"
 *         description: "The google ID (xxx@aegee.eu) of the group that is added"
 *         format: "email"
 *       groupName:
 *         type: "string"
 *         description: "The name of the Google group"
 *         format: "string"
 *       bodyPK:
 *         type: "string"
 *         description: "The primary key that identifies the body/circle in MyAEGEE"
 *         format: "string"
 *     required:
 *       - groupName
 *       - primaryEmail
 *       - bodyPK
 *     example:
 *       groupName: "The Straight Banana Committee"
 *       primaryEmail: "sbc@aegee.eu"
 *       bodyPK: "(idk how it's represented)"
 *
 *   Account:
 *     type: "object"
 *     properties:
 *       primaryEmail:
 *         type: "string"
 *         description: "The username @aegee.eu for the account"
 *         format: "string"
 *       name:
 *         $ref: "#/definitions/Account_name"
 *       secondaryEmail:
 *         type: "string"
 *         description: "The email of the user. For password reset and first-time sign up"
 *         format: "email"
 *       password:
 *         type: "string"
 *         description: "MUST be a SHA-1 password"
 *         format: "password"
 *       antenna:
 *         type: "string"
 *         description: "The (primary) antenna the user belongs to"
 *         format: "string"
 *       userPK:
 *         type: "string"
 *         description: "The primary key of the user in MyAEGEE"
 *     required:
 *       - primaryEmail
 *       - name
 *       - secondaryEmail
 *       - password
 *       - antenna
 *       - userPK
 *     example:
 *       primaryEmail: "cave.johnson@aegee.eu"
 *       name:
 *         givenName: "Cave"
 *         familyName: "Johnson"
 *       secondaryEmail: "cave.aegee@example.com"
 *       password: "[SOME-SHA1-HASH]"
 *       antenna: "AEGEE-Tallahassee"
 *       userPK: "(idk how it's represented)"
 *
 *   Account_name:
 *     properties:
 *       givenName:
 *         type: "string"
 *       familyName:
 *         type: "string"
 *     required:
 *       - givenName
 *       - familyName
 *     example:
 *       givenName: "Cave"
 *       familyName: "Johnson"
 *
 *   Membership:
 *     type: "object"
 *     properties:
 *       groupPK:
 *         type: "string"
 *         description: "(required) The group in which the user \
 *                       is added. MyAEGEE's PK of the body/circle"
 *       operation:
 *         type: "string"
 *         description: "(required) 'add'/'remove' member"
 *     required:
 *       - groupPK
 *       - operation
 *     example:
 *       groupPK: "(idk how it's represented)"
 *       operation: "add"
 *
 *   aliasOperation:
 *     type: "object"
 *     properties:
 *       aliasName:
 *         type: "string"
 *         description: "The alias that is added"
 *       operation:
 *         type: "string"
 *         description: "'add'/'remove' alias"
 *     required:
 *       - aliasName
 *       - operation
 *     example:
 *       aliasName: "example@aegee.eu"
 *       operation: "add"
 *
 *   Body:
 *     properties:
 *       name:
 *         type: "string"
 *         description: "The name of the event"
 *       description:
 *         type: "string"
 *         description: "Format MUST be YYYY-MM-DD"
 *       task_description:
 *         type: "string"
 *         description: "Format MUST be YYYY-MM-DD"
 *       code:
 *         type: "string"
 *         description: "The description of the event"
 *       email:
 *         type: "string"
 *         description: "The city where the event is happening. Can be any string"
 *       phone:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *       address:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *       type:
 *         type: "string"
 *         description: "One of 'antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other'"
 *       fee_currency:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *       pays_fees:
 *         type: "bool"
 *         description: "Format MUST be a-v 0-9"
 *       founded_at:
 *         type: "date"
 *         description: "Format MUST be a-v 0-9"
 *       status:
 *         type: "One of 'active', 'deleted'"
 *         description: "Format MUST be a-v 0-9"
 *       country:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *       website:
 *         type: "string"
 *         description: "Format MUST be a-v 0-9"
 *     description: "(required)"
 *     required:
 *       - name
 *       - description
 *       - task_description
 *       - code
 *       - email
 *       - phone
 *       - address
 *       - type
 *       - fee_currency
 *       - pays_fees
 *       - founded_at
 *       - status
 *       - website
 *       - country
 *     example:
 *       name: "RTC Tallahassee"
 *       startDate: "2019-04-25"
 *       endDate: "2019-04-25"
 *       description: "An RTC in a far away place"
 *       location: "Tallahassee, Florida"
 *       eventID: "rtctallahassee19"
 */
/// ///////////////////////////////////////////////////////////
