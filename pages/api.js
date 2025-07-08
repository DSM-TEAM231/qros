import { createQRIS, checkStatus, deactivateQRIS } from '../system_qris'
import orkut from '../setting'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'

// Init Firebase client
const firebaseApp = initializeApp(orkut.firebaseProdukConfig)
const db = getDatabase(firebaseApp)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { amount, logoUrl, total, transactionId, action, customId } = req.body

    // ✅ 1. Cek status transaksi dari internal UI
    if (total && transactionId) {
      const trx = await checkStatus(orkut.merchant, orkut.key, transactionId)
      if (trx?.status === 'inactive') {
        return res.json({ paid: false, info: null, inactive: true })
      }
      const paid = trx && parseInt(trx.amount) === parseInt(total)
      return res.json({ paid, info: trx || null })
    }

    // ✅ 2. Batalkan QRIS
    if (action === 'cancel' && transactionId) {
      await deactivateQRIS(transactionId)
      return res.json({ success: true, message: 'QRIS dinonaktifkan' })
    }

    // ✅ 3. Buat QRIS: untuk internal UI atau pihak ketiga via customId
    if (amount) {
      const requestAmount = parseInt(amount)
      const { min, max } = orkut.adminFeeRange
      const fee = Math.floor(Math.random() * (max - min + 1)) + min
      const finalTotal = requestAmount + fee

      const qris = await createQRIS(finalTotal, orkut.codeqr, logoUrl || null, customId || null)

      const response = {
        qrImageUrl: qris.qrImageUrl,
        nominal: requestAmount,
        fee,
        total: finalTotal,
        transactionId: qris.transactionId,
        expiredAt: qris.expiredAt
      }

      // ⛔ customId gak dikembalikan di response
      return res.json(response)
    }

    // ✅ 4. Buat QRIS dari Firebase pihak ketiga
    if (req.body.listenRequest === true) {
      const snap = await get(ref(db, `qris_request/${req.body.customId}`))
      const data = snap.val()
      if (!data || !data.amount) return res.status(404).json({ error: 'Permintaan tidak ditemukan' })

      const { min, max } = orkut.adminFeeRange
      const fee = Math.floor(Math.random() * (max - min + 1)) + min
      const finalTotal = parseInt(data.amount) + fee

      const qris = await createQRIS(finalTotal, orkut.codeqr, null, req.body.customId)

      return res.json({
        transactionId: qris.transactionId,
        qrImageUrl: qris.qrImageUrl,
        total: finalTotal,
        nominal: data.amount,
        fee,
        expiredAt: qris.expiredAt
      })
    }

    return res.status(400).json({ error: 'Permintaan tidak valid' })
  } catch (err) {
    console.error('❌ ERROR API:', err.message)
    return res.status(500).json({ error: err.message })
  }
}