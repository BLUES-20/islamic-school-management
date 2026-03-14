// setup-db-migration.js
require('dotenv').config();
const {
    Pool
} = require('pg');

const db = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'Hammad@1007',
    database: 'school_management',
    port: 5432,
});

async function runMigration() {
    const client = await db.connect();

    try {
        console.log('🔄 Running migration: Add password reset columns...\n');

        // Add columns if they don't exist
        await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
    `);
        console.log('✅ Columns added successfully');

        // Create index for faster lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reset_password_token ON users(reset_password_token);
    `);
        console.log('✅ Index created successfully');

        // Verify columns exist
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

        console.log('\n📋 Users table columns:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n✅ Migration completed successfully!');

    } catch (err) {
        console.error('❌ Migration error:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await db.end();
    }
}

runMigration();
