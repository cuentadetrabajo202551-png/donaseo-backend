const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// ── PostgreSQL — Railway Cloud ──
const pool = new Pool({
  connectionString: 'postgresql://postgres:jiWzgQxXiFKsSKqieYfgSltKHJLkrmPD@turntable.proxy.rlwy.net:38465/railway',
  ssl: { rejectUnauthorized: false }
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inducciones (
      id             BIGINT PRIMARY KEY,
      nombre         VARCHAR(200) NOT NULL,
      cedula         VARCHAR(20)  NOT NULL,
      dependencia    VARCHAR(200),
      cargo          VARCHAR(200),
      fecha          VARCHAR(50),
      nota           INTEGER,
      estado         VARCHAR(20),
      certificado    VARCHAR(5)   DEFAULT 'No',
      tipo           VARCHAR(20)  DEFAULT 'Induccion',
      edificio       VARCHAR(200),
      celular        VARCHAR(20),
      fec_expedicion VARCHAR(20),
      ciudad         VARCHAR(100),
      departamento   VARCHAR(100),
      creado_en      TIMESTAMP    DEFAULT NOW()
    );
  `);
  const cols = [
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS tipo           VARCHAR(20)  DEFAULT 'Induccion'",
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS edificio       VARCHAR(200)",
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS celular        VARCHAR(20)",
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS fec_expedicion VARCHAR(20)",
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS ciudad         VARCHAR(100)",
    "ALTER TABLE inducciones ADD COLUMN IF NOT EXISTS departamento   VARCHAR(100)",
  ];
  for (const sql of cols) await pool.query(sql).catch(()=>{});
  console.log('✅ Schema ready');
}

pool.connect((err, client, release) => {
  if (err) { console.error('❌ PostgreSQL error:', err.message); return; }
  console.log('✅ Connected to PostgreSQL — Railway');
  release();
  ensureSchema();
});

// GET /records
app.get('/records', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM inducciones ORDER BY creado_en DESC');
    res.json({ ok:true, records: r.rows.map(row=>({
      id:             String(row.id),
      name:           row.nombre        ||'',
      cedula:         row.cedula        ||'',
      dep:            row.dependencia   ||'',
      cargo:          row.cargo         ||'',
      fecha:          row.fecha         ||'',
      nota:           row.nota          ||0,
      passed:         row.estado        ==='Aprobado',
      certDownloaded: row.certificado   ==='Si',
      tipo:           row.tipo          ||'Induccion',
      edificio:       row.edificio      ||'',
      celular:        row.celular       ||'',
      fec_expedicion: row.fec_expedicion||'',
      ciudad:         row.ciudad        ||'',
      departamento:   row.departamento  ||'',
    })) });
  } catch(err) { res.json({ok:false, error:err.message}); }
});

// GET /check/:cedula
app.get('/check/:cedula', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,nombre,fecha,tipo FROM inducciones WHERE cedula=$1 AND estado='Aprobado' ORDER BY creado_en DESC LIMIT 1",
      [req.params.cedula]
    );
    res.json({ ok:true, exists: r.rows.length>0, record: r.rows[0]||null });
  } catch(err) { res.json({ok:false, error:err.message}); }
});

// POST /save
app.post('/save', async (req, res) => {
  try {
    const { id,name,cedula,dep,cargo,fecha,nota,passed,certDownloaded,
            tipo,edificio,celular,fec_expedicion,ciudad,departamento } = req.body;
    const ex = await pool.query('SELECT id FROM inducciones WHERE id=$1',[id]);
    if (ex.rows.length) return res.json({ok:true, message:'Already exists'});
    await pool.query(
      `INSERT INTO inducciones (id,nombre,cedula,dependencia,cargo,fecha,nota,estado,certificado,
        tipo,edificio,celular,fec_expedicion,ciudad,departamento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id,name,cedula,dep,cargo,fecha,nota,
       passed?'Aprobado':'Reprobado', certDownloaded?'Si':'No',
       tipo||'Induccion', edificio||'', celular||'', fec_expedicion||'', ciudad||'', departamento||'']
    );
    console.log(`✅ Saved: ${name} — ${passed?'Aprobado':'Reprobado'} (${nota}%)`);
    res.json({ok:true});
  } catch(err) { res.json({ok:false, error:err.message}); }
});

// POST /updatecert
app.post('/updatecert', async (req, res) => {
  try {
    await pool.query("UPDATE inducciones SET certificado='Si' WHERE id=$1",[req.body.id]);
    res.json({ok:true});
  } catch(err) { res.json({ok:false, error:err.message}); }
});

// DELETE /record/:id
app.delete('/record/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM inducciones WHERE id=$1 RETURNING nombre,cedula',[req.params.id]);
    if (r.rows.length) { console.log(`🗑️  Deleted: ${r.rows[0].nombre}`); res.json({ok:true}); }
    else res.json({ok:false, error:'Not found'});
  } catch(err) { res.json({ok:false, error:err.message}); }
});

// GET /health
app.get('/health', (req,res) => res.json({ok:true, message:'Don Aseo API running en Railway 🚀'}));

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   DON ASEO LTDA — API Backend Cloud   ║');
  console.log(`║   Running on port ${PORT}               ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});
