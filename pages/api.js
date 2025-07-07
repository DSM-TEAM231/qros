import { createQRIS, checkStatus, deactivateQRIS } from '../system_qris'
import orkut from '../setting'
import { airtableRequest } from '../setting'

// ====================
// ✅ POLLING AIRTABLE
// ====================

let isPolling = false;

async function pollingWebLain() {
  if (isPolling) return;
  isPolling = true;

  try {
    const filterFormula = `status="pending"`;
    const response = await airtableRequest('get', null, `?filterByFormula=${encodeURIComponent(filterFormula)}`);
    const records = response.records || [];

    for (const record of records) {
      const recordId = record.id;
      const fields = record.fields;
      const { id, nominal } = fields;
      if (!id || !nominal) continue;

      const amount = parseInt(nominal);
      const result = await createQRIS(amount, fields.codeqr || '', fields.logo || null);

      await airtableRequest('patch', {
        idTransaksi: result.transactionId,
        url_qris: result.qrImageUrl,
        expired: result.expirationTime,
        amount: amount,
        status: 'waiting'
      }, recordId);

      console.log(`[Polling] QRIS dibuat untuk ID ${id} nominal ${nominal}`);
    }
  } catch (err) {
    console.error('[Polling Error]', err.message);
  }

  isPolling = false;
}

// ====================
// ✅ HANDLER API
// ====================

export default async function handler(req, res) {
  // ✅ Trigger polling manual dari HTML
  if (req.method === 'GET' && req.query.trigger) {
    await pollingWebLain();
    return res.status(200).json({ message: 'Polling selesai' });
  }

  if (req.method === 'POST') {
    try {
      const { amount, logoUrl, total, transactionId, action } = req.body;

      // ✅ CEK STATUS QRIS
      if (total && transactionId) {
        const trx = await checkStatus(orkut.merchant, orkut.key, transactionId);
        if (trx?.status === 'inactive') {
          return res.json({ paid: false, info: null, inactive: true });
        }
        const paid = trx && parseInt(trx.amount) === parseInt(total);
        return res.json({ paid, info: trx || null });
      }

      // ✅ BATALKAN QRIS
      if (action === 'cancel' && transactionId) {
        await deactivateQRIS(transactionId);
        return res.json({ success: true, message: 'QRIS dinonaktifkan' });
      }

      // ✅ BUAT QRIS BARU
      if (amount) {
        const requestAmount = parseInt(amount);
        const { min, max } = orkut.adminFeeRange;
        const fee = Math.floor(Math.random() * (max - min + 1)) + min;
        const finalTotal = requestAmount + fee;
        const qris = await createQRIS(finalTotal, orkut.codeqr, logoUrl);

        return res.json({
          qrImageUrl: qris.qrImageUrl,
          nominal: requestAmount,
          fee,
          total: finalTotal,
          transactionId: qris.transactionId
        });
      }

      res.status(400).json({ error: 'Invalid request' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).end();
  }
}