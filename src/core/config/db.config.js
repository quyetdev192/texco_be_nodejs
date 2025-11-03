const mongoose = require('mongoose');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

class DatabaseConfig {
    constructor() {
        this.dbType = process.env.DB_TYPE || 'mongodb';
        this.connections = {};
    }

    async connectMongoDB() {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/project-name';
            await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('MongoDB connected successfully');
            return mongoose.connection;
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async connectPostgreSQL() {
        try {
            const pool = new Pool({
                host: process.env.POSTGRES_HOST || 'localhost',
                port: process.env.POSTGRES_PORT || 5432,
                database: process.env.POSTGRES_DB || 'project_name',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'password',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            await pool.query('SELECT NOW()');
            console.log('PostgreSQL connected successfully');
            this.connections.postgres = pool;
            return pool;
        } catch (error) {
            console.error('PostgreSQL connection error:', error);
            throw error;
        }
    }

    async connectMySQL() {
        try {
            const connection = await mysql.createConnection({
                host: process.env.MYSQL_HOST || 'localhost',
                port: process.env.MYSQL_PORT || 3306,
                database: process.env.MYSQL_DB || 'project_name',
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD || 'password',
            });

            console.log('MySQL connected successfully');
            this.connections.mysql = connection;
            return connection;
        } catch (error) {
            console.error('MySQL connection error:', error);
            throw error;
        }
    }

    async connect() {
        switch (this.dbType) {
            case 'mongodb':
                return await this.connectMongoDB();
            case 'postgresql':
                return await this.connectPostgreSQL();
            case 'mysql':
                return await this.connectMySQL();
            default:
                throw new Error(`Unsupported database type: ${this.dbType}`);
        }
    }

    async disconnect() {
        switch (this.dbType) {
            case 'mongodb':
                if (mongoose.connection.readyState === 1) {
                    await mongoose.disconnect();
                    console.log('MongoDB disconnected');
                }
                break;
            case 'postgresql':
                if (this.connections.postgres) {
                    await this.connections.postgres.end();
                    console.log('PostgreSQL disconnected');
                }
                break;
            case 'mysql':
                if (this.connections.mysql) {
                    await this.connections.mysql.end();
                    console.log('MySQL disconnected');
                }
                break;
        }
    }

    getConnection() {
        switch (this.dbType) {
            case 'mongodb':
                return mongoose.connection;
            case 'postgresql':
                return this.connections.postgres;
            case 'mysql':
                return this.connections.mysql;
            default:
                return null;
        }
    }
}

module.exports = new DatabaseConfig(); 