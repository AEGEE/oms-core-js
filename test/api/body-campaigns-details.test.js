const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body campaign details', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the campaign is not found', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if id is not a number', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/xxx',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if campaign doesn\'t belong to this body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();
        const otherBody = await generator.createBody();

        const campaign = await generator.createCampaign({ autojoin_body_id: otherBody.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find the campaign by id', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(campaign.id);
    });
});