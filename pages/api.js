import { createQRIS, checkStatus, deactivateQRIS } from '../system_qris'
import orkut from '../setting'

export default async function handler(req, res) {
  // === CORS HEADER (WAJIB untuk akses dari domain lain / localhost) ===
  res.setHeader('Access-Control-Allow-Origin', '*'); // Untuk produksi, ganti '*' dengan domain frontend kamu
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // === Handle preflight OPTIONS ===
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      // Ambil semua parameter termasuk customId untuk pihak ketiga
      const { amount, logoUrl, total, transactionId, action, customId } = req.body

      // 1. CEK STATUS TRANSAKSI (bisa pakai transactionId atau customId)
      if (total && (transactionId || customId)) {
        const trx = await checkStatus(orkut.merchant, orkut.key, transactionId, customId)
        if (trx?.status === 'inactive') {
          return res.json({ paid: false, info: null, inactive: true })
        }
        const paid = trx && parseInt(trx.amount) === parseInt(total)
        return res.json({ paid, info: trx || null })
      }

      // 2. CANCEL TRANSAKSI (bisa pakai transactionId atau customId)
      if (action === 'cancel' && (transactionId || customId)) {
        await deactivateQRIS(transactionId, customId)
        return res.json({ success: true, message: 'QRIS dinonaktifkan' })
      }

      // 3. BUAT QRIS BARU (bisa dari UI Next.js atau HTML pihak ketiga)
      if (amount) {
        const requestAmount = parseInt(amount)
        const { min, max } = orkut.adminFeeRange
        const fee = Math.floor(Math.random() * (max - min + 1)) + min
        const finalTotal = requestAmount + fee
        // Jika customId ada, berarti request dari pihak ketiga
        const qris = await createQRIS(finalTotal, orkut.codeqr, logoUrl, customId)

        res.json({
          qrImageUrl: qris.qrImageUrl,
          nominal: requestAmount,
          fee,
          total: finalTotal,
          transactionId: qris.transactionId,
          customId: qris.customId || undefined
        })
        return
      }

      res.status(400).json({ error: 'Invalid request' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else {
    res.status(405).end()
  }
}
