// Importar Mongoose
const mongoose = require('mongoose');

// Configurar dotenv
require('dotenv').config({path: 'variables.env'});

const conectarDB = async () => {
    try {
        await mongoose.connect(process.env.DB_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });

        console.log('DB Conectada');
    } catch(error){
        console.log('Hubo un error', error);
        process.exit(1);
    }
}

module.exports = conectarDB;
