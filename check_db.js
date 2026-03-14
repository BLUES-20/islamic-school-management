const pool = require('./config/db');

async function checkDatabase() {
    try {
        const res = await pool.query("SELECT * FROM results WHERE subject = 'QVJBQklD' OR subject = 'ARABIC'");
        console.log('Results found:', res.rows);

        if (res.rows.length > 0) {
            console.log('Found subjects that might be encoded.');
            for (const row of res.rows) {
                if (row.subject === 'QVJBQklD') {
                    console.log(`Fixing row ID ${row.id}: ${row.subject} -> ARABIC`);
                    // await pool.query("UPDATE results SET subject = 'ARABIC' WHERE id = $1", [row.id]);
                }
            }
        } else {
            console.log('No results found for QVJBQklD or ARABIC');
            const allSubjects = await pool.query("SELECT DISTINCT subject FROM results LIMIT 10");
            console.log('Sample subjects in DB:', allSubjects.rows);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkDatabase();
