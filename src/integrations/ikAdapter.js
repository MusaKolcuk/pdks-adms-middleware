/**
 * BU DOSYA KASITLI OLARAK BOS BIRAKILDI.
 *
 * Bu ara servisin tek gorevi: kart okuyucu cihazlardan ADMS protokolu ile
 * gelen giris-cikis olaylarini toplamak, personel ile eslestirmek ve
 * attendance_events tablosuna guvenilir sekilde kaydetmek.
 *
 * Bu olayi sizin IK urununuze gercekten aktarmak (kendi ic API'niz,
 * veritabaniniz veya mesaj kuyrugunuz uzerinden) size ait bir is - o yuzden
 * bu dosyaya dokunmadim, asagidaki fonksiyonu siz dolduracaksiniz.
 *
 * handleAttendanceEvent(event), attendanceService.recordEvent() yeni bir
 * olay kaydettiginde (fire-and-forget, hata firlatirsa sadece loglanir,
 * cihazin ADMS akisini bozmaz) su sekilde bir event objesiyle cagrilir:
 *
 * {
 *   id: 123,                          // attendance_events.id (bu servisteki kayit)
 *   tenantId: "firma-1",              // devices.tenant_id (hangi musteri/firma)
 *   deviceSn: "CJH8232900123",        // cihazin seri no'su
 *   deviceUserId: "42",               // cihaza kayitli kullanici/kart ID'si
 *   personnelId: "P-1042",            // card_mappings uzerinden eslesen personel ID (eslesme yoksa null)
 *   personnelName: "Ayse Yilmaz",     // card_mappings.personnel_name (varsa)
 *   eventTime: "2026-09-18T08:02:11", // ISO 8601, cihazin gonderdigi yerel saat
 *   direction: "in",                  // "in" | "out" | "unknown" - bkz. attendanceService.inferDirection
 *   rawStatus: "0",                   // cihazdan gelen ham status kodu
 *   verifyMode: "1",                  // 1=parmak izi, 15=kart, vb. (cihaz/firmware'e gore degisir)
 * }
 *
 * Yapmaniz gereken: bu fonksiyon icinde kendi IK uygulamanizin ilgili
 * fonksiyonunu/endpoint'ini cagirip personelId (veya deviceUserId) ile
 * eslesen personelin giris/cikis kaydini olusturmak. Ornegin:
 *
 *   const result = await kendiIkApiClient.girisCikisKaydiOlustur({
 *     personelId: event.personnelId,
 *     zaman: event.eventTime,
 *     yon: event.direction,
 *   });
 *
 * Basarisiz olursa bir hata firlatabilirsiniz; attendanceService bunu
 * yakalayip attendance_events.sync_error alanina yazar, synced=0 kalir,
 * boylece daha sonra hangi kayitlarin IK sistemine ulasmadigini
 * (senkron gecmisi / retry) sorgulayabilirsiniz.
 */

async function handleAttendanceEvent(event) {
  // TODO: kendi IK urununuze baglayin.
  throw new Error('ikAdapter.handleAttendanceEvent henuz implement edilmedi');
}

module.exports = { handleAttendanceEvent };
