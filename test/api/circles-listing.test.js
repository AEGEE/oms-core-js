const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circles list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const circle = await generator.createCircle();

        const res = await request({
            uri: '/circles',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(circle.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        await generator.createCircle();
        const circle = await generator.createCircle();
        await generator.createCircle();

        const res = await request({
            uri: '/circles?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(circle.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const firstCircle = await generator.createCircle({ name: 'aaa' });
        const secondCircle = await generator.createCircle({ name: 'bbb' });

        const res = await request({
            uri: '/circles?sort=name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondCircle.id);
        expect(res.body.data[1].id).toEqual(firstCircle.id);
    });
});