const axios = require('axios')
const FormData = require('form-data')
const QRCode = require('qrcode')
const sharp = require('sharp')
const { airtableApiKey, airtableBaseId, airtableTable, qrisExpiredMinutes } = require('./setting')

const airtableApiBaseUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTable}`

// Mendukung query string atau recordId
async function airtableRequest(method, data = null, recordIdOrQuery = null) {
  let url = airtableApiBaseUrl;
  if (recordIdOrQuery) {
    url += recordIdOrQuery.startsWith('?') ? recordIdOrQuery : `/${recordIdOrQuery}`;
  }

  const config = {
    method,
    url: url,
    headers: {
      'Authorization': `Bearer ${airtableApiKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (data) {
    config.data = JSON.stringify({ fields: data });
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error with Airtable ${method} request to ${url}:`, error.response?.data || error.message);
    throw new Error(`Airtable API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

function convertCRC16(str) {
  let crc = 0xFFFF
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ("000" + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4)
}

function generateTransactionId() {
  return 'TRX-' + Math.random().toString(36).substring(2, 10) + Date.now().toString().substring(8);
}

function generateExpirationTime() {
  const expirationTime = new Date()
  expirationTime.setMinutes(expirationTime.getMinutes() + qrisExpiredMinutes)
  return expirationTime.toISOString();
}

async function overlayLogo(qrBuffer, urlLogo) {
  if (!urlLogo) return qrBuffer
  try {
    const logoRes = await axios.get(urlLogo, { responseType: 'arraybuffer' })
    const logoBuffer = Buffer.from(logoRes.data, 'binary')
    const resizedLogo = await sharp(logoBuffer)
      .resize(100, 100)
      .toBuffer()
    const qrWithLogo = await sharp(qrBuffer)
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .toBuffer()
    return qrWithLogo
  } catch (err) {
    console.warn("Gagal overlay logo di QR:", err.message);
    return qrBuffer
  }
}

// MODIFIKASI: tambah customId (untuk pihak ketiga)
async function createQRIS(amount, codeqr, logoUrl = null, customId = null) {
  let qrisData = codeqr.slice(0, -4)
  const step1 = qrisData.replace("010211", "010212")
  const step2 = step1.split("5802ID")
  amount = amount.toString()
  let uang = "54" + ("0" + amount.length).slice(-2) + amount + "5802ID"
  const result = step2[0] + uang + step2[1] + convertCRC16(step2[0] + uang + step2[1])

  const qrCodeBuffer = await QRCode.toBuffer(result, {
    color: {
      dark: '#1864ab',
      light: '#e7f5ff'
    },
    width: 500,
    margin: 2
  })

  const finalBuffer = await overlayLogo(qrCodeBuffer, logoUrl)

  const form = new FormData()
  form.append('file', finalBuffer, { filename: 'qr.png', contentType: 'image/png' })
  const response = await axios.post('https://cdn.itzky.xyz/', form, {
    headers: form.getHeaders()
  })

  const transactionId = generateTransactionId()
  const expirationTime = generateExpirationTime()

  const qrisRecordData = {
    transactionId: transactionId,
    amount: parseFloat(amount),
    qrImageUrl: response.data.fileUrl,
    status: 'active',
    expiredAt: expirationTime
  }
  if (customId) qrisRecordData.customId = customId;

  await airtableRequest('post', qrisRecordData);

  return {
    transactionId: transactionId,
    amount: amount,
    expirationTime: expirationTime,
    qrImageUrl: response.data.fileUrl,
    customId: customId || undefined
  }
}

// MODIFIKASI: cek status bisa pakai transactionId ATAU customId
async function checkStatus(merchant, token, transactionId = null, customId = null) {
  let filterByFormula = null;
  if (transactionId) {
    filterByFormula = `transactionId='${transactionId}'`;
  } else if (customId) {
    filterByFormula = `customId='${customId}'`;
  }

  if (filterByFormula) {
    const airtableRecords = await airtableRequest('get', null, `?filterByFormula=${encodeURIComponent(filterByFormula)}`);

    if (airtableRecords.records && airtableRecords.records.length > 0) {
      const qrisRecord = airtableRecords.records[0].fields;
      const qrisRecordId = airtableRecords.records[0].id;

      if (new Date(qrisRecord.expiredAt) < new Date()) {
        if (qrisRecord.status !== 'expired') {
          await airtableRequest('patch', { status: 'expired' }, qrisRecordId);
        }
        return { status: 'inactive' };
      }

      if (qrisRecord.status !== 'active') {
        return { status: 'inactive' };
      }
      return qrisRecord;
    } else {
      return { status: 'inactive' };
    }
  }

  // fallback: cek ke OkeConnect jika tidak ada di Airtable
  try {
    const apiUrl = `https://gateway.okeconnect.com/api/mutasi/qris/${merchant}/${token}`
    const response = await axios.get(apiUrl)
    const result = response.data
    return result.data[0]
  } catch (err) {
    console.error('Error checking QRIS status from OkeConnect:', err.message);
    return null
  }
}

// MODIFIKASI: bisa expired pakai transactionId atau customId
async function deactivateQRIS(transactionId = null, customId = null) {
  let filterByFormula = null;
  if (transactionId) {
    filterByFormula = `transactionId='${transactionId}'`;
  } else if (customId) {
    filterByFormula = `customId='${customId}'`;
  }
  if (!filterByFormula) return;

  const airtableRecords = await airtableRequest('get', null, `?filterByFormula=${encodeURIComponent(filterByFormula)}`);

  if (airtableRecords.records && airtableRecords.records.length > 0) {
    const qrisRecordId = airtableRecords.records[0].id;
    await airtableRequest('patch', {
      status: 'expired',
      expiredAt: new Date(Date.now() - 60000).toISOString() // expired 1 menit yang lalu
    }, qrisRecordId);
  }
}

module.exports = {
  createQRIS,
  checkStatus,
  deactivateQRIS
}
