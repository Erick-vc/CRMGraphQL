// configuración de la base de datos
import mongoose from 'mongoose';

import { config } from "dotenv";

config({path: 'variables.env'});
// require('dotenv').config({path: 'variables.env'});

const conectarDB = async () => {
  mongoose.set("strictQuery", false);
  try {
    await mongoose.connect(process.env.DB_MONGO, {

    });
    console.log('DB Conectada');
  } catch (error) {
    console.log('Hubo un error');
    console.log(error);
    process.exit(1);
  }
}

export default conectarDB;