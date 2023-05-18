import { ApolloServer } from "apollo-server";
import typeDefs from "../db/schema.js";
import resolvers from "../db/resolvers.js";
import conectarDB from "../config/db.js";
import jwt from "jsonwebtoken";
import { config } from "dotenv";

config({path: 'variables.env'});

// ! Conectar a la base da datos
conectarDB();

// servidor  - el context está disponible en todo los resolvers
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {

    // console.log(req.headers);

    // verificamos si el jwt existe
    const token = req.headers["authorization"] || "";
    if (token) {
      try {
        const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRETA);
        // console.log(usuario);
        return {
          usuario,
        };
      } catch (error) {
        console.log("Hubo un error");
        console.log(error);
      }
    }
  },
});

// arracancar el servidor
server.listen({port: process.env.PORT || 5000 }).then(({ url }) => {
  console.log(`Servidor listo en la URL ${url}`);
});
