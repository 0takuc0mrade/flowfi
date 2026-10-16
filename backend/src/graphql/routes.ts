import { makeSchema } from "@nexus/schema";
import * as types from "./src/graphql/schema";
import { requestContext } from "nexus";
import express from "express";

export const schema = makeSchema({
  types: types.Schema,
  outputs: {
    schema: null,
    typegen: undefined,
  },
  sourceTypes: {
    import: ["nexus"],
    module: {
      defineType: ["nexus"],
      objectType: ["nexus"],
      inputObjectType: ["nexus"],
      enumType: ["nexus"],
      list: ["nexus"],
      mutationType: ["nexus"],
    },
  },
});

export const graphqlRoutes = express.Router();

graphqlRoutes.post("/", requestContext(), async (req, res) => {
  const result = await schema.execute({
    query: req.body.query,
    variables: req.body.variables,
    operationName: req.body.operationName,
    context: req as any,
  });
  res.json(result);
});

graphqlRoutes.get("/", requestContext(), async (req, res) => {
  const result = await schema.execute({
    query: "{ __schema { types { name } } }",
    context: req as any,
  });
  res.json(result);
});