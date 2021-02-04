// Importar Modelos
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

require('dotenv').config({path: 'variables.env'});
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');


// FUNCIONES
const crearToken = (usuario, palabraSecreta, expiresIn) => {

    // Destructuring al usuario que entra por parametro
    const { id, email, nombre, apellido } = usuario;

    // Firmar el token
    return jwt.sign({
        id, email, nombre, apellido
    }, palabraSecreta, {
        expiresIn
    })
}


// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            return ctx.usuario;
        },

        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos;
            } catch(error){
                console.log(error);
            }
        },

        obtenerProducto: async (_, {id}) => {

            // Validar si el producto existe o no
            const producto = await Producto.findById(id);

            if(!producto){
                throw new Error("Producto no encontrado");
            }

            return producto;
        },

        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});

                return clientes;
            } catch(error){
                console.log(error);
            }
        },

        obtenerClientesVendedor: async (_, {}, ctx) => {
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });

                return clientes;
            } catch(error){
                console.log(error);
            }
        },

        obtenerCliente: async (_, {id}, ctx) => {

            // Validar que el cliente exista
            const cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error("El cliente no existe");
            }

            // El usuario que lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No tienes las credenciales");
            }

            return cliente;
        },

        obtenerPedidos : async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch(error){
                console.log(error);
            }
        },

        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente');
                return pedidos;
            } catch(error){
                console.log(error);
            }
        },

        obtenerPedido: async (_, {id}, ctx) => {

            // Validar si el pedido existe
            const pedido = await Pedido.findById(id);

            if(!pedido){
                throw new Error("El pedido consultado no se encuentra");
            }

            // Solamente quien lo creó puede verlo
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No cuentas con credenciales para consultar este pedido");
            }

            // Retornar el resultado con el pedido
            return pedido;
        },

        obtenerPedidosEstado: async (_, {estado}, ctx) => {
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado});

            return pedidos;
        },

        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match : { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$cliente",
                    total: {$sum: "$total"}
                }},
                {
                    $lookup: {
                        from: "clientes",
                        localField: "_id",
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                { $sort: {total: -1}}
            ]);

            return clientes;
        },

        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$vendedor",
                    total: {$sum: "$total"}
                }},
                {
                    $lookup: {
                        from: "usuarios",
                        localField: "_id",
                        foreignField: "_id",
                        as: "vendedor"
                    }
                },
                { $limit: 3 },
                { $sort: {total: -1} }
            ]);

            return vendedores;
        },

        buscarProducto: async (_, {texto}) => {
            const productos = await Producto.find({ $text: { $search: texto } });

            return productos;
        }

    },

    Mutation: {
        nuevoUsuario: async (_, {input}) => {

            // Destructuring
            const { email, password } = input;

            // Revisar que el usuario no este registrado
            const existeUsuario = await Usuario.findOne({email});

            if(existeUsuario) {
                throw new Error('El email ya se encuentra registrado');
            }

            // Hashear el password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            try {
                // Guardarlo en la base de datos
                const usuario = new Usuario(input);
                await usuario.save();
                return usuario;
            } catch(error){
                console.log(error);
            }
        },

        autenticarUsuario: async (_, {input}) => {

            // Destructuring
            const { email, password } = input;

            // Validar si el usuario existe
            const existeUsuario = await Usuario.findOne({email});

            if(!existeUsuario) {
                throw new Error('El email no se encuentra registrado');
            }

            // Validar que el password sea correcto
            const passCorrecto = await bcryptjs.compare(password, existeUsuario.password);

            if(!passCorrecto){
                throw new Error('El password ingresado es incorrecto');
            }

            // Crear el token
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
        },

        nuevoProducto: async (_, {input}) => {
            try {
                const producto = new Producto(input);
                const resultado = await producto.save();

                return resultado;
            } catch(error){
                console.log(error);
            }
        },

        actualizarProducto: async (_, {id, input}) => {
            // Validar si el producto existe
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error("Producto no encontrado");
            }

            // Guardarlo en la DB
            producto = await Producto.findOneAndUpdate({_id: id}, input, {new: true});

            return producto;
        },

        eliminarProducto: async (_, {id}) => {
            // Validar si el producto existe
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error("Producto no encontrado");
            }

            // Eliminar de la BD
            await Producto.findOneAndDelete({_id: id});

            return "Producto eliminado satisfactoriamente";
        },

        nuevoCliente: async (_, {input}, ctx) => {

            // Destructuring al input
            const { email } = input;

            // Verificar si el cliente ya está registrado
            const cliente = await Cliente.findOne({email});

            if(cliente){
                throw new Error("El cliente ya se encuentra registrado");
            }

            const nuevoCliente = new Cliente(input);

            // Asignar el vendedor
            nuevoCliente.vendedor = ctx.usuario.id;

            try {
                // Guardar en la base de datos
                await nuevoCliente.save();

                return nuevoCliente;
            } catch(error){
                console.log(error);
            }
        },

        actualizarCliente: async (_, {id, input}, ctx) => {

            // Validar que el cliente exista
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error("El cliente no existe");
            }

            // Validar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No cuenta con credenciales para editar este cliente");
            }

            // Actualizar el cliente
            cliente = await Cliente.findOneAndUpdate({_id: id}, input, {new: true});

            return cliente;
        },

        eliminarCliente: async (_, {id}, ctx) => {
            // Validar que el cliente exista
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error("El cliente no existe");
            }

            // Validar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No cuenta con credenciales para eliminar este cliente");
            }

            // Eliminar Cliente
            await Cliente.findOneAndDelete({_id: id});
            return "Cliente eliminado satisfactoriamente";
        },

        nuevoPedido: async (_, {input}, ctx) => {

            // Destructuring al input
            const { cliente } = input;

            // Verificar si el cliente existe
            const existeCliente = await Cliente.findById({_id: cliente});
            if(!cliente){ throw new Error("El cliente no existe")}

            // Validar si el cliente pertenece al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No tienes credenciales");
            }

            // Validar que el stock esté disponible
            for await (const articulo of input.pedido){
                const { id, cantidad } = articulo;
                const producto = await Producto.findById(id);

                if(articulo.cantidad > producto.existencia){
                    throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                } else {
                    // Restar la cantidad al stock disponible
                    producto.existencia = producto.existencia - cantidad;
                    await producto.save();
                }
            }

            // Crear nuevo pedido
            const nuevoPedido = new Pedido(input);

            // Asignarle el vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            //Guardar en BD
            await nuevoPedido.save();

            return nuevoPedido;
        },

        actualizarPedido: async (_, {id, input}, ctx) => {

            // Destructuring al input
            const { cliente } = input;

            // validar si el pedido existe
            const existePedido = await Pedido.findById(id);

            if(!existePedido){
                throw new Error("El pedido consultado no se encuentra");
            }

            // Validar si el cliente existe
            const existeCliente = await Cliente.findById(cliente);

            if(!existeCliente){
                throw new Error("El cliente no existe");
            }

            // Validar si el cliente y el pedido pertenecen al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No cuentas con credenciales");
            }

            // Revisar el stock
            if(input.pedido){
                for await (const articulo of input.pedido){
                    const { id, cantidad } = articulo;
                    const producto = await Producto.findById(id);

                    if(articulo.cantidad > producto.existencia){
                        throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                    } else {
                        // Restar la cantidad al stock disponible
                        producto.existencia = producto.existencia - cantidad;
                        await producto.save();
                    }
                }
            }

            // Guardar el pedido actualizado
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, {new: true});

            return resultado;
        },

        eliminarPedido: async (_, {id}, ctx) => {

            // Validar si el pedido existe
            const existePedido = await Pedido.findById(id);

            if(!existePedido){
                throw new Error("El pedido consultado no se encuentra");
            }

            // Validar si el vendedor es quien lo va a borrar
            if(existePedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No cuentas con credenciales");
            }

            // Borrar pedido
            await Pedido.findOneAndDelete({ _id: id });

            return "Pedido eliminado satisfactoriamente";

        }
    }
}

module.exports = resolvers;
