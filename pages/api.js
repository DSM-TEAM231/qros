import { createQRIS, checkStatus, deactivateQRIS } from '../system_qris'
import orkut from '../setting'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { amount, logoUrl, total, transactionId, action } = req.body

      if (total && transactionId) {
        const trx = await checkStatus(orkut.merchant, orkut.key, transactionId)
        if (trx?.status === 'inactive') {
          return res.json({ paid: false, info: null, inactive: true })
        }
        const paid = trx && parseInt(trx.amount) === parseInt(total)
        return res.json({ paid, info: trx || null })
      }

      if (action === 'cancel' && transactionId) {
        await deactivateQRIS(transactionId)
        return res.json({ success: true, message: 'QRIS dinonaktifkan' })
      }

      if (amount) {
        const requestAmount = parseInt(amount)
        const { min, max } = orkut.adminFeeRange
        const fee = Math.floor(Math.random() * (max - min + 1)) + min
        const finalTotal = requestAmount + fee
        const qris = await createQRIS(finalTotal, orkut.codeqr, logoUrl)

        res.json({
          qrImageUrl: qris.qrImageUrl,
          nominal: requestAmount,
          fee,
          total: finalTotal,
          transactionId: qris.transactionId
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
