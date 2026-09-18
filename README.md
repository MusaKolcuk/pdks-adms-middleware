# PDKS ADMS Ara Servisi

ZKTeco ve benzeri (ADMS/Push protokolu destekleyen) kart okuyucu cihazlardan
gelen giris-cikis kayitlarini toplayan, personel ile eslestiren ve bir
"integration point" uzerinden sizin IK uygulamaniza aktarmaya hazir hale
getiren ara servis (middleware).

## Bu servis ne yapiyor, ne yapmiyor

Yapiyor:
- Kart okuyucu cihazin ADMS protokolu ile gonderdigi HTTP isteklerini
  karsiliyor (`/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd`).
- Cihazdan gelen ham giris-cikis satirlarini ayristirip kendi veritabaninda
  (SQLite) saklıyor.
- Cihaza kayitli "kullanici ID"sini (kart okutulunca cihazin gonderdigi ID)
  sizin personel ID'nize eslestiren basit bir tablo sunuyor.
- Cok kiracili (multi-tenant) yapiyi destekliyor: her cihaz bir firmaya
  (tenantId) baglaniyor.

Yapmiyor:
- Kendi IK uygulamaniza veriyi gercekten yazmiyor. Bu kismi siz
  yazacaksiniz — bkz. `src/integrations/ikAdapter.js`. Servis, her yeni
  olayda bu dosyadaki fonksiyonu cagiriyor; ic mantiginizi (kendi API'niz,
  veritabaniniz, kuyruk vb.) oraya siz ekleyeceksiniz.

## Kurulum

```bash
npm install
cp .env.example .env
# .env icindeki ADMIN_API_KEY'i mutlaka degistirin
npm start
```

Servis varsayilan olarak `8080` portunda ayaga kalkar.

## 1. Adim: Cihazi ve firmayi kaydedin

Her kart okuyucu, hangi firmaya ait oldugunu bilmemiz icin once
kaydedilmeli:

```bash
curl -X POST http://localhost:8080/admin/devices \
  -H "x-api-key: <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"sn": "CJH8232900123", "tenantId": "firma-1", "name": "Ana Giris Kapisi"}'
```

`sn` (seri no), cihazin uzerinde/menusunde yazan seri numarasidir. Bu
kaydedilmeden gelen istekler 403 ile reddedilir — yani tanimadiginiz bir
cihazdan gelen veri sisteme giremez.

## 2. Adim: Kart / personel eslestirmesi ekleyin

Cihaza bir kart ogretilirken cihaz tarafinda bir "kullanici ID" atanir
(genelde kucuk bir sayi). Bu ID'yi personel kaydinizla eslestirin:

```bash
curl -X POST http://localhost:8080/admin/mappings \
  -H "x-api-key: <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "firma-1",
    "deviceSn": "CJH8232900123",
    "deviceUserId": "42",
    "personnelId": "P-1042",
    "personnelName": "Ayse Yilmaz"
  }'
```

Pratik ipucu: cihaza kart ogretirken kullanici ID'sini dogrudan personelin
sizin sisteminizdeki numarasiyla ayni verirseniz, bu eslestirme adimina hic
gerek kalmaz. Ama farkli firmalarda farkli numaralandirma olabilecegi icin
bu tabloyu esnek birakildik.

## 3. Adim: Cihazi bu servise yonlendirin

Cihazin menusunde genelde "Bulut Sunucu Ayarlari / Cloud Server Setting"
gibi bir bolum olur. Oraya:

- Sunucu adresi: bu servisin calistigi (prod'da mutlaka HTTPS olan) genel
  adres, ornegin `pdks.sizinalanadiniz.com`
- Port: `8080` (ya da reverse proxy arkasindaysaniz 443)
- ADMS/Cloud modu: **acik**

yazmaniz yeterli. Cihaz acildiktan sonra otomatik olarak
`/iclock/cdata?SN=...&options=all` ile "handshake" yapar, sonra periyodik
olarak `/iclock/cdata?SN=...&table=ATTLOG` ile kart okutma olaylarini
push eder.

## Test: gercek cihaz olmadan bir kart okutmayi simule etmek

```bash
# Not: eventTime'i her denemede degistirin, ayni SN+deviceUserId+zaman
# kombinasyonu tekrar POST edilirse "duplicate" olarak yoksayilir.
curl -X POST "http://localhost:8080/iclock/cdata?SN=CJH8232900123&table=ATTLOG" \
  -H "Content-Type: text/plain" \
  --data-binary $'42\t2026-09-18 08:02:11\t0\t1\t0'
```

Sonra kaydin geldigini kontrol edin:

```bash
curl -H "x-api-key: <ADMIN_API_KEY>" \
  "http://localhost:8080/admin/events?deviceSn=CJH8232900123"
```

`personnelId` alaninin dolu gelmesi, eslestirmenin dogru calistigini
gosterir.

## IK uygulamanaza baglamak

`src/integrations/ikAdapter.js` icindeki `handleAttendanceEvent(event)`
fonksiyonu, her yeni giris-cikis olayinda cagrilir. Dosyanin icindeki
yorumda `event` objesinin tam sekli ve alanlarin anlami aciklaniyor. Kendi
IK uygulamanizin ic API'sini/veritabanini oraya baglamaniz yeterli;
servisin geri kalani (protokol, dogrulama, eslestirme, tekilleştirme)
zaten hazir.

Fonksiyon hata firlatirsa kayit `attendance_events` tablosunda
`synced = 0` ve `sync_error` dolu olarak kalir — yani IK tarafina
ulasamayan kayitlari sonradan bulup tekrar deneyebilirsiniz.

## Guvenlik notlari (onemli)

- ADMS protokolunun kendisinde cihaz basina bir "sifre/token" mekanizmasi
  yok; cihazlar sadece seri numarasiyla taniniyor. Bu yuzden:
  - Servisi mutlaka HTTPS arkasinda calistirin (ornegin nginx + Let's
    Encrypt reverse proxy).
  - Mumkunse cihaz ile sunucu arasinda bir VPN veya IP allowlist kullanin,
    ozellikle birden fazla firmaya kurulum yapacaksaniz.
  - Seri numaralarini (SN) tahmin edilmesi zor, disariya sizdirilmamasi
    gereken bir bilgi gibi dusunun.
- `/admin` altindaki API'yi asla internete acik/anahtarsiz birakmayin;
  `.env` icindeki `ADMIN_API_KEY`'i guclu bir degerle degistirin.
- Bu implementasyon, ZKTeco'nun resmi olarak yayinlamadigi ama toplulukca
  yaygin dogrulanmis ADMS davranisina dayanir. Satin alacaginiz gercek
  cihazla ilk testte `/admin/events` uzerinden gelen `rawStatus` ve
  `verifyMode` degerlerini kontrol edin; firmware'e gore kucuk farkliliklar
  cikarsa `src/services/attendanceService.js` icindeki
  `STATUS_DIRECTION_MAP`'i ona gore guncelleyin.

## Proje yapisi

```
src/
  server.js                    Express uygulamasini baslatir
  config.js                    .env okur
  db.js                        SQLite semasi (devices, card_mappings, attendance_events)
  routes/
    adms.js                    Cihazlarin konustugu ADMS protokolu uc noktalari
    admin.js                   Cihaz/eslestirme yonetimi + test amacli event listeleme
  services/
    deviceService.js           Cihaz kayitlari
    cardMappingService.js      Kart/kullanici ID <-> personel eslestirmesi
    attendanceService.js       ATTLOG ayristirma, giris/cikis tahmini, kayit
  integrations/
    ikAdapter.js                IK urununuze baglayacaginiz nokta (siz dolduracaksiniz)
```
