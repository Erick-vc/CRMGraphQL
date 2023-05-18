import Usuarios from "../models/Usuarios.js";
import Producto from "../models/Producto.js";
import Cliente from "../models/Clientes.js";
import Pedido from "../models/Pedido.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "dotenv";

config({path: 'variables.env'});
// require("dotenv").config({ path: "variables.env" });
// el de arriba para verificar y firmar el token tiene que ser la misma: SECRETAR

const crearToken = (usuario, secreta, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;
  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

// Resolver
const resolvers = {
  Query: {
    // ! Usuario **************
    obtenerUsuario: async (_, {}, ctx) => {
      return ctx.usuario;
    },
    obtenerUsuarios: async () => {
      try {
        const vendedores = await Usuarios.find({});
        return vendedores;
      } catch (error) {
        console.log(error);
      }
    },

    // ! Productos **************
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      // Revisar si el producto existe o no
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // Sí, es un ObjectId válido, proceda con la llamada `findById`.
        const producto = await Producto.findById(id);
        return producto;
      } else {
        throw new Error("Producto no encontrado");
      }
    },

    // ! Clientes **************
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      if (ctx.usuario.id !== undefined) {
        //  El contex tiene el usuario que está autenticado
        try {
          const clientes = await Cliente.find({
            vendedor: ctx.usuario.id.toString(),
          });
          return clientes;
        } catch (error) {
          console.log(error);
        }
      } else {
        return null;
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      // Revisar si el cliente existe o no
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // ? Sí, es un ObjectId válido, proceda con la llamada `findById`.
        const cliente = await Cliente.findById(id);

        // Quien lo creó puede verlo
        if (cliente.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }
        return cliente;
      } else {
        throw new Error("Cliente no encontrado");
      }
    },

    // ! Pedidos **************
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({
          vendedor: ctx.usuario.id,
        }).populate("cliente");
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // Verificar si el pedido existe o no
        const pedido = await Pedido.findById(id);
        // Solo quien lo cree puede verlo
        if (pedido.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }
        // retornar el resultado
        return pedido;
      } else {
        throw new Error("El pedido no ha sido encontrado");
      }
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({
        vendedor: ctx.usuario.id,
        estado: estado,
      });
      return pedidos;
    },

    // ! Mejores cliente **************
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $limit: 19,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return clientes;
    },

    // ! Mejores vendedores **************
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);
      return productos;
    },
  },

  //!
  Mutation: {
    //! USUARIO
    // * CREAR NUEVO USUARIO
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      // Revisar si el usuario ya está registrado
      const existeUsuario = await Usuarios.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya está registrado");
      }

      // Hashear su password
      const salt = await bcryptjs.genSaltSync(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        // Guardar en la base da datos
        const usuario = new Usuarios(input);
        usuario.save();
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },

    // * AUTOENTICAR USUARIO
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      // Si el usuario existe
      const existeUsuario = await Usuarios.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }

      // Revisar si el password es correcto
      const passwordcorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordcorrecto) {
        throw new Error("El password es incorrecto");
      }

      // Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },

    //! PRODUCTO
    // * CREAR NUEVO PRODUCTO
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);
        const resultado = await producto.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },

    // * ACTUALIZAR PRODUCTO
    actualizarProducto: async (_, { id, input }) => {
      // Revisar si el producto existe o no
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // Sí, es un ObjectId válido, proceda con la llamada `findById`.
        let producto = await Producto.findById(id);
        //? guardarlo en la base de datos
        //? id, lo qe actualiza y dare true
        producto = await Producto.findOneAndUpdate({ _id: id }, input, {
          new: true,
        });
        return producto;
      } else {
        throw new Error("Producto no encontrado");
      }
    },

    // * ELIMINAR PRODUCTO
    eliminarProducto: async (_, { id }) => {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        //  eliminando
        await Producto.findOneAndDelete({ _id: id });
        return "Producto eliminado";
      } else {
        throw new Error("Producto no encontrado");
      }
    },

    // ! CLIENTE
    // * CREAR NUEVO CLIENTE
    nuevoCliente: async (_, { input }, ctx) => {
      console.log(ctx);

      const { email } = input;
      // Verificar si el cliente ya está registrado
      console.log(input);

      const cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("El cliente ya está registrado");
      }

      const nuevoCliente = new Cliente(input);
      // Asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id;

      // Guardarlo en la base de datos
      try {
        const resultado = await nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    // * ACTUALIZAR CLIENTE
    actualizarCliente: async (_, { id, input }, ctx) => {
      // Verificar si existe o no
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        let cliente = await Cliente.findById(id);

        // Verificar si el vendedor es quien edita
        if (cliente.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }

        // Guardar el cliente
        cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
          new: true,
        });
        return cliente;
      } else {
        throw new Error("Ese cliente no existe");
      }
    },
    // * ELIMINAR CLIENTE
    eliminarCliente: async (_, { id }, ctx) => {
      // Verificar si existe o no
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        let cliente = await Cliente.findById(id);

        // Verificar si el vendedor es quien edita
        if (cliente.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }

        // Elminar cliente
        await Cliente.findOneAndDelete({ _id: id });
        return "Cliente eliminado";
      } else {
        throw new Error("Ese cliente no existe");
      }
    },

    // ! PEDIDO
    // * CREAR NUEVO PEDIDO
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;
      // Verificar si el cliente existe o no
      if (cliente.match(/^[0-9a-fA-F]{24}$/)) {
        let clienteExiste = await Cliente.findById(cliente);
        // Verificar si el cliente el del vendedor
        if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tiene las credenciales");
        }
        // Revisar que el stock esté disponible
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          if (id.match(/^[0-9a-fA-F]{24}$/)) {
            const producto = await Producto.findById(id);
            if (articulo.cantidad > producto.existencia) {
              throw new Error(
                `El artículo: ${producto.nombre} excede la cantidad disponible`
              );
            } else {
              // Restar la cantidad a la disponible
              producto.existencia = producto.existencia - articulo.cantidad;
              await producto.save();
            }
          } else {
            throw new Error("El id del producto no existe");
          }
        }
        // Crear un nuevo pedido
        const nuevoPedido = new Pedido(input);

        // Asignarle un vendedor
        nuevoPedido.vendedor = ctx.usuario.id;

        // Guardar en la base de datos
        const resultado = await nuevoPedido.save();
        return resultado;
      } else {
        throw new Error("Ese cliente no existe");
      }
    },
    // * ACTUALIZAR PEDIDO
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // Verificar si el pedido existe
        const existePedido = await Pedido.findById(id);

        // Verificar si el cliente existe
        if (cliente.match(/^[0-9a-fA-F]{24}$/)) {
          const existeCliente = await Cliente.findById(cliente);

          // Verificar si el cliente y pedido pertenece al vendedor
          if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
            throw new Error("No tienes las credenciales");
          }
        } else {
          throw new Error("El cliente no existe");
        }
        // Revisar el stock
        if (input.pedido) {
          for await (const articulo of input.pedido) {
            const { id } = articulo;
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
              const producto = await Producto.findById(id);
              if (articulo.cantidad > producto.existencia) {
                throw new Error(
                  `El artículo: ${producto.nombre} excede la cantidad disponible`
                );
              } else {
                // Restar la cantidad a la disponible
                producto.existencia = producto.existencia - articulo.cantidad;
                await producto.save();
              }
            } else {
              throw new Error("El id del producto no existe");
            }
          }
        }
        // Guardar el pedido - new true para que retonrne el nuevo objeto
        const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
          new: true,
        });
        return resultado;
      } else {
        throw new Error("El pedido no existe");
      }
    },
    // * ELIMINAR PEDIDO
    eliminarPedido: async (_, { id }, ctx) => {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // Si el pedido existe o no
        const pedido = await Pedido.findById(id);

        // Si el vendedor es quien lo borra
        if (pedido.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }
        // Eliminar el na base de datos
        await Pedido.findOneAndDelete({ _id: id });
        return "Pedido Eliminado";
      } else {
        throw new Error("El pedido no existe");
      }
    },
  },
};

export default resolvers;
