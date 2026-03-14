const fs = require('fs');
const path = require('path');
const db = require('./config/db');

async function setupDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the entire schema as one query
        await db.query(schema);

        console.log('✅ Database schema created successfully!');
    } catch (error) {
        console.error('❌ Error creating database schema:', error);
    } finally {
        await db.end();
    }
}

setupDatabase();
