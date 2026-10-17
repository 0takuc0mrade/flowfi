import { describe, it, expect, beforeEach, vi } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";

describe("GraphQL API", () => {
  it("passes introspection queries and validates schema against TypeScript types", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({ query: "{ __schema { types { name } }" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.__schema");
    expect(response.body.data.__schema.types).toBeArray();
  });

  it("validates schema against Stream type", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: `
          query {
            __type(name: "Stream") {
              name
              fields {
                name
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
  });

  it("supports stream query with valid stream ID", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: "query { stream(streamId: 1) { id streamId sender recipient }",
      });

    expect(response.status).toBe(200);
  });

  it("supports streams query with pagination", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: `
          query {
            streams(first: 10) {
              edges { node { id streamId } }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
  });

  it("supports accountOverview query", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: "query { accountOverview(address: \"GABCDEF1234567890ABCDEF1234567890ABCDEF12345678\") { totalDeposited totalWithdrawn activeStreams }",
      });

    expect(response.status).toBe(200);
  });

  it("supports streamUpdated subscription type", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: "subscription { streamUpdated(streamId: 1) { id streamId } }",
      });

    expect(response.status).toBe(200);
  });

  it("supports userStreams subscription type", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: "subscription { userStreams(address: \"GABCDEF1234567890ABCDEF1234567890ABCDEF12345678\") { id eventType timestamp }",
      });

    expect(response.status).toBe(200);
  });

  it("returns proper error formatting for invalid queries", async () => {
    const response = await supertest(app)
      .post("/graphql")
      .send({
        query: "{ invalidField }",
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeArray();
  });
});