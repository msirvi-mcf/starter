import request from 'supertest';
import express from 'express';
import eventRouter from '../../src/routes/event.route';

jest.mock('../../src/controllers/event.controller', () => ({
  post: jest.fn(async (req, res) => res.status(200).json({ success: true }))
}));
jest.mock('../../src/utils/logger.utils', () => ({
  logger: { info: jest.fn() }
}));

describe('POST /event', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/event', eventRouter);
   
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
  });

  it('should call the controller and return 200', async () => {
    const res = await request(app)
      .post('/event')
      .send({ foo: 'bar' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('should handle errors thrown by the controller', async () => {
    const { post } = require('../../src/controllers/event.controller');
    post.mockImplementationOnce(() => { throw new Error('fail'); });

    const res = await request(app)
      .post('/event')
      .send({ foo: 'bar' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'fail');
  });
});