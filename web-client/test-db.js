const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://postgres.scbqioxxfyoghyeawhfz:Luthfi%402005%23@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
});
client.connect()
    .then(() => {
        console.log('Connected successfully to AP-SOUTH-1 Pooler');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection error', err.message);
        process.exit(1);
    });
