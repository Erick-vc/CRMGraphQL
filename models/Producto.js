import mongoose from "mongoose";

const ProductoSchema = mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  existencia: {
    type: Number,
    required: true,
    trim: true
  },
  precio: {
    type: Number,
    required: true,
    trim: true
  },
  creado: {
    type: Date,
    default: Date.now()
  }
});

// Un indice que podemos consultar.
ProductoSchema.index({ nombre: 'text'});

export default mongoose.model('Producto', ProductoSchema);