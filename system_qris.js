const axios = require('axios')
const FormData = require('form-data')
const QRCode = require('qrcode')
const sharp = require('sharp')
const { firebaseProdukConfig, qrisExpiredMinutes } = require('./setting')
const { initializeApp } = require('firebase/app')
const {
  getDatabase,
  ref,
  get,
  set,
  update,
  child
} = require('firebase/database')

// Inisialisasi Firebase
const firebaseApp = initializeApp(firebaseProdukConfig)
const db = getDatabase(firebaseApp)

// === UTILITAS ===
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
  return 'TRX-' + Math.random().toString(36).substring(2, 10) + Date.now().toString().substring(8)
}

function generateExpirationTime() {
  const expirationTime = new Date()
  expirationTime.setMinutes(expirationTime.getMinutes() + qrisExpiredMinutes)
  return expirationTime.toISOString()
}

async function overlayLogo(qrBuffer, urlLogo) {
  if (!urlLogo) return qrBuffer
  try {
    const logoRes = await axios.get(urlLogo, { responseType: 'arraybuffer' })
    const logoBuffer = Buffer.from(logoRes.data, 'binary')
    const resizedLogo = await sharp(logoBuffer).resize(100, 100).toBuffer()
    const qrWithLogo = await sharp(qrBuffer).composite([{ input: resizedLogo, gravity: 'center' }]).toBuffer()
    return qrWithLogo
  } catch (err) {
    console.warn("Gagal overlay logo di QR:", err.message)
    return qrBuffer
  }
}

// === FUNGSI UTAMA ===
async function createQRIS(amount, codeqr, logoUrl = null, customId = null) {
  const baseQR = codeqr.slice(0, -4)
  const modifiedQR = baseQR.replace("010211", "010212")
  const [head, tail] = modifiedQR.split("5802ID")
  const amountStr = amount.toString()
  const uang = "54" + ("0" + amountStr.length).slice(-2) + amountStr + "5802ID"
  const fullQR = head + uang + tail + convertCRC16(head + uang + tail)

  const qrCodeBuffer = await QRCode.toBuffer(fullQR, {
    color: { dark: '#1864ab', light: '#e7f5ff' },
    width: 500,
    margin: 2
  })

  const finalBuffer = await overlayLogo(qrCodeBuffer, logoUrl)

  const form = new FormData()
  form.append('file', finalBuffer, { filename: 'qr.png', contentType: 'image/png' })
  const upload = await axios.post('https://cdn.itzky.xyz/', form, { headers: form.getHeaders() })

  const transactionId = generateTransactionId()
  const expiredAt = generateExpirationTime()

  const qrisData = {
    transactionId,
    amount: parseFloat(amount),
    qrImageUrl: upload.data.fileUrl,
    status: 'active',
    expiredAt
  }

  if (customId) {
    await set(ref(db, `qris_request/${customId}`), qrisData)
  } else {
    await set(ref(db, `qris/${transactionId}`), qrisData)
  }

  return qrisData
}

async function checkStatus(merchant, token, transactionId = null) {
  if (transactionId) {
    const snap = await get(child(ref(db), `qris/${transactionId}`))
    const record = snap.val()
    if (!record) return { status: 'inactive' }

    const expired = new Date(record.expiredAt) < new Date()
    if (expired && record.status !== 'expired') {
      await update(ref(db, `qris/${transactionId}`), {
        status: 'expired',
        expiredAt: new Date(Date.now() - 60000).toISOString()
      })
      return { status: 'inactive' }
    }

    if (record.status !== 'active') return { status: 'inactive' }
  }

  try {
    const url = `https://gateway.okeconnect.com/api/mutasi/qris/${merchant}/${token}`
    const res = await axios.get(url)
    return res.data.data[0]
  } catch (err) {
    console.error('Error cek status QRIS dari OkeConnect:', err.message)
    return null
  }
}

async function deactivateQRIS(transactionId) {
  const snap = await get(child(ref(db), `qris/${transactionId}`))
  if (snap.exists()) {
    await update(ref(db, `qris/${transactionId}`), {
      status: 'expired',
      expiredAt: new Date(Date.now() - 60000).toISOString()
    })
  }
}

module.exports = {
  createQRIS,
  checkStatus,
  deactivateQRIS
}