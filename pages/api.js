import { createQRIS, checkStatus, deactivateQRIS } from '../system_qris'
import orkut from '../setting'

export default async function handler(req, res) {
  // === CORS HEADER (WAJIB untuk akses dari domain lain / localhost) ===
  res.setHeader('Access-Control-Allow-Origin', '*') // Produksi: ganti '*' ke domain frontend kamu
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // === Handle preflight OPTIONS ===
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      const { amount, logoUrl, total, transactionId, action, customId } = req.body

      // === CEK STATUS (polling) ===
      if (total && (transactionId || customId)) {
        const trx = await checkStatus(orkut.merchant, orkut.key, transactionId, customId)

        if (trx?.status === 'inactive') {
          return res.json({ paid: false, info: null, inactive: true })
        }

        const paid = trx?.status === 'paid' && parseInt(trx.amount) === parseInt(total)
        return res.json({ paid, info: trx || null, inactive: false })
      }

      // === CANCEL QRIS ===
      if (action === 'cancel' && (transactionId || customId)) {
        await deactivateQRIS(transactionId, customId)
        return res.json({ success: true, message: 'QRIS dinonaktifkan' })
      }

      // === BUAT QRIS BARU ===
      if (amount) {
        const requestAmount = parseInt(amount)
        const { min, max } = orkut.adminFeeRange
        const fee = Math.floor(Math.random() * (max - min + 1)) + min
        const finalTotal = requestAmount + fee

        const qris = await createQRIS(finalTotal, orkut.codeqr, logoUrl, customId)

        return res.json({
          qrImageUrl: qris.qrImageUrl,
          nominal: requestAmount,
          fee,
          total: finalTotal,
          transactionId: qris.transactionId,
          customId: qris.customId || undefined
        })
      }

      return res.status(400).json({ error: 'Invalid request parameters' })
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Internal server error' })
    }
  }

  return res.status(405).end() // Method Not Allowed
}