const si = require('systeminformation');
const { Pool } = require('pg');

// Configuração da conexão com o banco de dados
const pool = new Pool({
  connectionString: 'postgres://gabriel.santos15053:BvLskDfV1e6I@ep-bitter-cloud-06207514.us-east-2.aws.neon.tech/neondb',
  ssl: {
    rejectUnauthorized: false,
  },
});

// Função para obter informações do sistema e inserir no banco de dados
async function insertSystemInfo() {
  try {
    const systemInfo = await si.getStaticData();

    const jsonString = JSON.stringify(systemInfo, null, 2);
    const createDate = new Date().toISOString();

    const insertQuery = `
      INSERT INTO public.system_info (data, create_date)
      VALUES ($1, $2)
    `;
    const values = [jsonString, createDate];

    await pool.query(insertQuery, values);
    console.log('Informações inseridas no banco de dados com sucesso');
  } catch (error) {
    console.error('Erro ao inserir informações no banco de dados:', error.message);
  } finally {
    // Encerra a pool de conexões após a inserção (opcional)
    pool.end();
  }
}

// Chama a função para obter informações do sistema e inserir no banco de dados
insertSystemInfo();
