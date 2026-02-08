# Ghid de Depanare

Acest ghid vă ajută să rezolvați singuri problemele comune întâmpinate în sistemul de gestionare a concediilor. Găsiți soluții pas cu pas pentru fiecare tip de problemă.

---

## Cuprins

1. [Probleme de Autentificare](#probleme-de-autentificare)
   - [Nu mă pot conecta la aplicație](#nu-mă-pot-conecta-la-aplicație)
   - [Eroare "User not found"](#eroare-user-not-found)
   - [Sesiunea a expirat](#sesiunea-a-expirat)
   - [Probleme cu autentificarea în doi pași (2FA)](#probleme-cu-autentificarea-în-doi-pași-2fa)
   - [Contul este blocat](#contul-este-blocat)
2. [Probleme cu Cererile](#probleme-cu-cererile)
   - [Nu pot trimite o cerere de concediu](#nu-pot-trimite-o-cerere-de-concediu)
   - [Cererea nu apare în sistem](#cererea-nu-apare-în-sistem)
   - [Nu pot anula o cerere](#nu-pot-anula-o-cerere)
   - [Soldul de zile este incorect](#soldul-de-zile-este-incorect)
   - [Documentul nu se încarcă](#documentul-nu-se-încarcă)
3. [Probleme de Afișare](#probleme-de-afișare)
   - [Pagina nu se încarcă complet](#pagina-nu-se-încarcă-complet)
   - [Calendar-ul nu se afișează corect](#calendar-ul-nu-se-afișează-corect)
   - [Textul sau butoanele sunt tăiate](#textul-sau-butoanele-sunt-tăiate)
   - [Notificările nu apar](#notificările-nu-apar)
   - [Limba nu se schimbă](#limba-nu-se-schimbă)
4. [Probleme de Performanță](#probleme-de-performanță)
   - [Aplicația se încarcă greu](#aplicația-se-încarcă-greu)
   - [Formularele răspund lent](#formularele-răspund-lent)
   - [Exportul durează mult](#exportul-durează-mult)
5. [Raportarea Problemelor](#raportarea-problemelor)
   - [Ce informații să includeți](#ce-informații-să-includeți)
   - [Unde să raportați](#unde-să-raportați)
   - [Timp de răspuns estimat](#timp-de-răspuns-estimat)
6. [Contact Suport](#contact-suport)

---

## Probleme de Autentificare

### Nu mă pot conecta la aplicație

**Simptome:**
- Butonul "Sign in with Microsoft" nu funcționează
- Apare o eroare după autentificarea Microsoft
- Sunteți redirecționat înapoi la pagina de login

**Soluții pas cu pas:**

#### Pasul 1: Verificați conexiunea la internet

1. Deschideți un alt site web (de exemplu, google.com) pentru a verifica conexiunea
2. Dacă nu funcționează, reporniți routerul sau contactați administratorul de rețea
3. Dacă folosiți VPN, încercați să vă deconectați și reconectați

#### Pasul 2: Verificați browser-ul

1. **Ștergeți cache-ul și cookie-urile:**
   - Chrome: `Ctrl + Shift + Delete` → Selectați "Cookies" și "Cache" → "Clear data"
   - Firefox: `Ctrl + Shift + Delete` → Selectați "Cache" și "Cookies" → "Clear Now"
   - Edge: `Ctrl + Shift + Delete` → Selectați "Cookies" și "Cached data" → "Clear now"

2. **Încercați modul incognito/privat:**
   - Chrome: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`
   - Edge: `Ctrl + Shift + N`

3. **Încercați un browser diferit** (Chrome, Firefox, Edge)

#### Pasul 3: Verificați adresa de email

1. Asigurați-vă că folosiți adresa de email a companiei (ex: prenume.nume@companie.ro)
2. Verificați că nu există spații înainte sau după adresă
3. Asigurați-vă că parola este corectă

#### Pasul 4: Verificați dacă contul este activ

Dacă sunteți angajat nou sau reactivat:
1. Contul trebuie să fie creat în sistem de către HR
2. Contactați departamentul HR pentru a verifica statusul contului

---

### Eroare "User not found"

**Simptome:**
- După autentificarea Microsoft, apare mesajul "User not found" sau "Utilizator inexistent"
- Nu aveți acces la aplicație deși autentificarea Microsoft a funcționat

**Cauza:**
Contul dvs. Microsoft există, dar nu este înregistrat în sistemul de gestionare a concediilor.

**Soluții:**

1. **Contactați departamentul HR:**
   - Cereți să verifice dacă sunteți înregistrat în sistem
   - Furnizați adresa exactă de email pe care o utilizați

2. **Verificați adresa de email:**
   - Asigurați-vă că folosiți aceeași adresă cu care ați fost înregistrat
   - Unele companii au mai multe domenii de email

3. **Așteptați activarea:**
   - Pentru angajații noi, contul este creat de HR
   - Procesul poate dura 1-2 zile lucrătoare

---

### Sesiunea a expirat

**Simptome:**
- Mesaj "Session expired" sau "Sesiunea a expirat"
- Sunteți deconectat automat
- Acțiunile nu se salvează

**Cauze posibile:**
- Inactivitate prelungită (peste 30 de minute)
- Cookie-uri blocate sau șterse
- Probleme de rețea

**Soluții:**

1. **Reconectați-vă:**
   - Faceți clic pe "Sign in with Microsoft" pentru a vă reconecta
   - Datele nesalvate pot fi pierdute

2. **Verificați setările de cookie:**
   - Asigurați-vă că browser-ul acceptă cookie-uri
   - Chrome: Settings → Privacy → Cookies → "Allow all cookies"

3. **Evitați expirarea sesiunii:**
   - Salvați frecvent munca în progres
   - Nu lăsați tab-ul inactiv pentru perioade lungi
   - Finalizați cererile într-o singură sesiune

---

### Probleme cu autentificarea în doi pași (2FA)

**Simptome:**
- Nu primiți codul de verificare
- Aplicația Authenticator nu generează coduri corecte
- Eroare la introducerea codului

**Soluții:**

#### Problema: Nu primiți codul SMS

1. Verificați dacă telefonul are semnal
2. Așteptați 30-60 de secunde - uneori SMS-urile întârzie
3. Cereți retrimiterea codului (opțiunea "Resend code")
4. Verificați dacă numărul de telefon este corect în contul Microsoft

#### Problema: Aplicația Authenticator nu funcționează

1. **Verificați ora pe telefon:**
   - Codurile sunt bazate pe timp - ora trebuie să fie sincronizată
   - Activați sincronizarea automată a orei: Settings → Date & Time → "Automatic"

2. **Încercați codul de pe un alt dispozitiv** (dacă aveți Authenticator configurat pe mai multe dispozitive)

3. **Folosiți o metodă alternativă:**
   - SMS
   - Apel telefonic
   - Email secundar (dacă este configurat)

#### Problema: Nu aveți acces la nicio metodă 2FA

1. Contactați **suportul IT al companiei**
2. IT poate reseta metodele de autentificare
3. Va trebui să reconfigurați 2FA după resetare

---

### Contul este blocat

**Simptome:**
- Mesaj "Account locked" sau "Cont blocat"
- Nu vă puteți autentifica deși parola este corectă

**Cauze:**
- Prea multe încercări de autentificare eșuate
- Politici de securitate ale companiei
- Contul a fost dezactivat de administrator

**Soluții:**

1. **Așteptați deblocarea automată:**
   - Majoritatea blocărilor se ridică automat după 15-30 de minute
   - Nu mai încercați să vă autentificați în această perioadă

2. **Contactați suportul IT:**
   - Dacă blocarea persistă, IT poate debloca contul manual
   - Pregătiți-vă să confirmați identitatea

3. **Resetați parola:**
   - Accesați [aka.ms/sspr](https://aka.ms/sspr)
   - Resetarea parolei poate debloca contul

---

## Probleme cu Cererile

### Nu pot trimite o cerere de concediu

**Simptome:**
- Butonul "Submit" nu funcționează
- Apare o eroare la trimitere
- Formularul se blochează

**Soluții pas cu pas:**

#### Pasul 1: Verificați câmpurile obligatorii

1. Asigurați-vă că ați selectat tipul de concediu
2. Verificați că ați ales cel puțin o zi în calendar
3. Verificați dacă ați selectat un înlocuitor (obligatoriu pentru majoritatea tipurilor)
4. Pentru concediu medical, verificați că ați încărcat certificatul medical

#### Pasul 2: Verificați soldul de zile

1. Numărul de zile solicitate nu poate depăși soldul disponibil
2. Verificați soldul în partea dreaptă a formularului
3. Zilele din cereri "În Așteptare" sunt deja rezervate

#### Pasul 3: Verificați perioada selectată

1. Nu puteți selecta date din trecut (pentru anumite tipuri de concediu)
2. Nu puteți solicita concediu în perioade când aveți deja cereri aprobate sau în așteptare
3. Verificați că nu ați depășit limita maximă de zile per cerere (ex: 14 zile pentru concediu de odihnă)

#### Pasul 4: Verificați semnătura

1. Semnătura digitală este obligatorie
2. Semnătura trebuie să conțină cel puțin 2 linii
3. Dacă semnătura nu se salvează, încercați să o refaceți

#### Pasul 5: Reîncărcați pagina

1. Apăsați `F5` sau `Ctrl + R` pentru a reîncărca
2. Reintroduceți datele și încercați din nou
3. Dacă problema persistă, încercați un browser diferit

---

### Cererea nu apare în sistem

**Simptome:**
- Ați trimis cererea dar nu o găsiți în "Recent Requests"
- Nu ați primit confirmare pe email
- Managerul spune că nu a primit cererea

**Soluții:**

1. **Verificați mesajul de confirmare:**
   - După trimitere trebuie să apară un mesaj de succes
   - Dacă nu a apărut, cererea probabil nu a fost trimisă

2. **Verificați filtrele:**
   - În lista de cereri, setați filtrul de status la "Toate"
   - Verificați că anul selectat este corect
   - Navigați prin toate paginile (cererile sunt paginate)

3. **Verificați email-ul:**
   - Căutați în Inbox emailul de confirmare
   - Verificați și folderul Spam/Junk

4. **Reîncărcați pagina:**
   - Apăsați `F5` pentru a reîncărca datele
   - Uneori sincronizarea durează câteva secunde

5. **Dacă cererea nu există:**
   - Trimiterea a eșuat din cauza unei erori de rețea
   - Creați cererea din nou și verificați mesajul de confirmare

---

### Nu pot anula o cerere

**Simptome:**
- Butonul "Cancel" nu apare
- Butonul "Cancel" este dezactivat (gri)
- Apare o eroare la anulare

**Cauze și soluții:**

| Situație | Cauza | Soluție |
|----------|-------|---------|
| Butonul nu apare | Cererea este deja anulată sau respinsă | Nu este necesară acțiune |
| Butonul este gri | Concediul este în desfășurare | Contactați HR pentru modificări |
| Eroare la anulare | Problemă temporară de sistem | Reîncărcați și încercați din nou |

**Când NU puteți anula:**
- Concediul a început deja
- Cererea a fost respinsă
- Cererea a fost deja anulată

**Ce puteți face:**
- Pentru concedii în desfășurare, contactați HR
- HR poate face ajustări manuale în cazuri justificate

---

### Soldul de zile este incorect

**Simptome:**
- Soldul afișat nu corespunde cu calculul dvs.
- Zilele nu s-au actualizat după o anulare
- Lipsesc zile din soldul anual

**Pași de verificare:**

#### Pasul 1: Înțelegeți formula

```
Disponibil = Acordat - Folosit - În Așteptare
```

- **Acordat**: Dreptul anual (poate fi pro-rata pentru angajații noi)
- **Folosit**: Zile din cereri aprobate și consumate
- **În Așteptare**: Zile din cereri trimise dar neaprobate

#### Pasul 2: Verificați cererile în așteptare

1. Zilele din cereri "Pending" sunt rezervate
2. Aceste zile reduc soldul disponibil
3. Se vor adăuga înapoi la anulare sau respingere

#### Pasul 3: Verificați calculul pro-rata

Dacă ați fost angajat în cursul anului:
- Soldul se calculează proporțional cu lunile rămase
- Exemplu: Angajare în iulie = 6/12 din soldul anual

#### Pasul 4: Verificați transferul din anul precedent

- Maximum 5 zile pot fi transferate din anul precedent
- Zilele transferate trebuie folosite până la 31 martie
- Zilele expirate sunt pierdute

#### Pasul 5: Contactați HR

Dacă discrepanța persistă:
1. Faceți o captură de ecran a soldului afișat
2. Pregătiți propriul calcul
3. Trimiteți ambele la HR pentru verificare

---

### Documentul nu se încarcă

**Simptome:**
- Eroare la încărcarea certificatului medical
- Fișierul nu se atașează la cerere
- Mesaj "File too large" sau format invalid

**Soluții:**

#### Verificați formatul fișierului

Formate acceptate:
- **Imagini**: JPEG, JPG, PNG
- **Documente**: PDF

Formate **neacceptate**: Word (.doc, .docx), Excel, arhive (.zip, .rar)

#### Verificați dimensiunea fișierului

- **Limita maximă**: 5 MB per fișier
- Dacă fișierul este prea mare:
  1. Pentru imagini: Redimensionați sau comprimați
  2. Pentru PDF: Folosiți un compresor PDF online
  3. Pentru documente scanate: Reduceți rezoluția la scanare

#### Alte soluții

1. **Încercați un browser diferit** - Unele browsere au probleme cu upload-ul
2. **Verificați conexiunea** - Upload-ul necesită conexiune stabilă
3. **Reîncărcați pagina** - Apoi încercați din nou
4. **Ștergeți cache-ul browser-ului** - Cache-ul corupt poate cauza probleme

---

## Probleme de Afișare

### Pagina nu se încarcă complet

**Simptome:**
- Pagină albă sau parțial încărcată
- Elemente lipsă (butoane, meniuri)
- Mesaj "Loading..." permanent

**Soluții:**

#### Pasul 1: Reîncărcați pagina

1. Apăsați `F5` pentru reîncărcare normală
2. Apăsați `Ctrl + F5` pentru reîncărcare forțată (ignoră cache-ul)

#### Pasul 2: Verificați conexiunea

1. Testați alte site-uri pentru a confirma conexiunea
2. Dacă folosiți VPN, încercați fără VPN
3. Dacă sunteți pe rețea mobilă, treceți pe Wi-Fi

#### Pasul 3: Ștergeți cache-ul

1. Chrome: `Ctrl + Shift + Delete` → selectați "Cache" → "Clear data"
2. Firefox: `Ctrl + Shift + Delete` → selectați "Cache" → "Clear Now"
3. Edge: `Ctrl + Shift + Delete` → selectați "Cached data" → "Clear now"

#### Pasul 4: Dezactivați extensiile

1. Extensiile de browser (ad blockers, etc.) pot interfera
2. Încercați în modul incognito/privat (`Ctrl + Shift + N`)
3. Dacă funcționează, dezactivați extensiile una câte una pentru a identifica problema

#### Pasul 5: Verificați browser-ul

Browsere suportate:
- Google Chrome (recomandat) - versiunea 90+
- Mozilla Firefox - versiunea 88+
- Microsoft Edge - versiunea 90+
- Safari - versiunea 14+

Browsere **nesuportate**: Internet Explorer

---

### Calendar-ul nu se afișează corect

**Simptome:**
- Zilele sunt suprapuse
- Calendar-ul este gol
- Lunile nu se schimbă

**Soluții:**

1. **Reîncărcați pagina** (`F5`)

2. **Verificați zoom-ul browser-ului:**
   - Setați zoom-ul la 100%: `Ctrl + 0`
   - Zoom prea mare sau mic poate afecta layout-ul

3. **Încercați alt browser:**
   - Chrome oferă cea mai bună compatibilitate
   - Firefox și Edge sunt alternative bune

4. **Verificați rezoluția ecranului:**
   - Rezoluție minimă recomandată: 1280x720
   - Pe ecrane mai mici, unele elemente pot fi comprimate

5. **Dezactivați extensiile de browser:**
   - Unele ad-blockere pot bloca elementele calendarului

---

### Textul sau butoanele sunt tăiate

**Simptome:**
- Text trunchiat (cu "...")
- Butoane parțial vizibile
- Layout-ul este dezordonat

**Soluții:**

1. **Ajustați zoom-ul browser-ului:**
   - Măriți: `Ctrl + +`
   - Micșorați: `Ctrl + -`
   - Reset la 100%: `Ctrl + 0`

2. **Maximizați fereastra:**
   - Aplicația este optimizată pentru ferestre maximizate
   - Pe ferestre mici, unele elemente se pot comprima

3. **Verificați rezoluția:**
   - Rezoluție minimă: 1280x720
   - Pentru experiență optimă: 1920x1080 sau mai mare

4. **Încercați modul landscape pe dispozitive mobile:**
   - Rotați telefonul/tableta orizontal
   - Folosiți opțiunea "Request desktop site" în browser

---

### Notificările nu apar

**Simptome:**
- Clopoțelul de notificări nu afișează badge
- Lista de notificări este goală
- Nu primiți email-uri de notificare

**Soluții pentru notificări în aplicație:**

1. **Reîncărcați pagina** - Notificările se sincronizează la încărcare

2. **Verificați filtrele** - Asigurați-vă că nu aveți filtre active

3. **Ștergeți cache-ul** - Cache-ul vechi poate afișa date neactualizate

**Soluții pentru email-uri:**

1. **Verificați folderul Spam/Junk:**
   - Email-urile de la sistem pot fi marcate ca spam
   - Marcați adresa expeditorului ca sigură

2. **Verificați adresa de email:**
   - Asigurați-vă că adresa din profil este corectă
   - Contactați HR dacă trebuie actualizată

3. **Verificați setările Outlook:**
   - Regulile de inbox pot redirecționa email-urile
   - Verificați folderele personalizate

---

### Limba nu se schimbă

**Simptome:**
- Selectorul de limbă nu funcționează
- Interfața rămâne în limba anterioară
- Unele texte sunt într-o limbă, altele în alta

**Soluții:**

1. **Așteptați câteva secunde:**
   - Schimbarea limbii necesită reîncărcarea unor elemente
   - Dacă nu se actualizează, reîncărcați manual pagina

2. **Ștergeți cache-ul:**
   - Preferințele de limbă pot fi cache-uite
   - Ștergeți cache-ul și încercați din nou

3. **Verificați setările browser-ului:**
   - Unele browsere forțează limba în funcție de setările de sistem
   - Verificați Language settings în browser

---

## Probleme de Performanță

### Aplicația se încarcă greu

**Simptome:**
- Încărcarea durează mai mult de 5 secunde
- Pagina este lentă la navigare
- Interfața se blochează momentan

**Soluții:**

#### Pasul 1: Verificați conexiunea la internet

1. Testați viteza: [speedtest.net](https://speedtest.net)
2. Viteza recomandată: minimum 5 Mbps
3. Dacă viteza este scăzută, contactați furnizorul de internet

#### Pasul 2: Închideți tab-urile și programele neutilizate

1. Fiecare tab consumă memorie
2. Închideți tab-urile neutilizate
3. Închideți aplicațiile care consumă resurse în fundal

#### Pasul 3: Ștergeți cache-ul browser-ului

1. Cache-ul acumulat poate încetini încărcarea
2. `Ctrl + Shift + Delete` → selectați "Cache" → ștergeți

#### Pasul 4: Dezactivați extensiile

1. Extensiile pot încetini semnificativ browser-ul
2. Dezactivați temporar extensiile și testați
3. Identificați extensia problematică și dezactivați-o permanent

#### Pasul 5: Reporniți browser-ul

1. Închideți complet browser-ul (toate ferestrele)
2. Așteptați 30 de secunde
3. Redeschideți și accesați aplicația

---

### Formularele răspund lent

**Simptome:**
- Întârziere la completarea câmpurilor
- Calendarul răspunde greu la click-uri
- Dropdown-urile se deschid lent

**Soluții:**

1. **Verificați memoria disponibilă:**
   - Windows: Task Manager → tab-ul Performance
   - Dacă memoria este peste 90%, închideți alte aplicații

2. **Reduceți complexitatea formularului:**
   - Selectați mai puține zile odată
   - Completați formularul pas cu pas

3. **Folosiți un browser modern:**
   - Chrome sau Firefox oferă performanță optimă
   - Actualizați browser-ul la ultima versiune

4. **Dezactivați auto-complete:**
   - Funcția auto-complete a browser-ului poate încetini formularele
   - Încercați să o dezactivați temporar

---

### Exportul durează mult

**Simptome:**
- Export CSV/Excel durează minute
- Browser-ul pare blocat în timpul exportului
- Exportul eșuează pentru seturi mari de date

**Soluții:**

1. **Fiți răbdător:**
   - Exporturile mari (>1000 înregistrări) pot dura mai mult
   - Nu închideți tab-ul în timpul exportului

2. **Reduceți volumul de date:**
   - Aplicați filtre înainte de export
   - Exportați perioade mai scurte

3. **Verificați spațiul pe disc:**
   - Exportul necesită spațiu pentru fișierul descărcat
   - Asigurați-vă că aveți cel puțin 100 MB liberi

4. **Verificați folderul Downloads:**
   - Fișierul poate fi deja descărcat
   - Browser-ul poate descărca fără a afișa progresul

---

## Raportarea Problemelor

### Ce informații să includeți

Pentru a primi ajutor rapid și eficient, includeți întotdeauna următoarele informații:

#### Informații obligatorii

| Informație | Exemplu |
|------------|---------|
| **Numele dvs.** | Popescu Ion |
| **Adresa de email** | ion.popescu@companie.ro |
| **Departamentul** | IT / Vânzări / HR |
| **Data și ora problemei** | 15 ianuarie 2024, ora 14:30 |
| **Descrierea problemei** | Nu pot trimite cererea de concediu - apare eroare "Network error" |

#### Informații tehnice (pentru probleme complexe)

| Informație | Cum o obțineți |
|------------|----------------|
| **Browser și versiune** | Chrome: Meniu (⋮) → Help → About Google Chrome |
| **Sistem de operare** | Windows 11 / macOS 14 / etc. |
| **Mesajul de eroare exact** | Copiați textul sau faceți captură de ecran |
| **Pași pentru reproducere** | 1. Am deschis... 2. Am apăsat pe... 3. A apărut eroarea... |

#### Capturi de ecran

**Cum să faceți capturi de ecran:**

- **Windows**: `Windows + Shift + S` → selectați zona → se copiază automat
- **Mac**: `Cmd + Shift + 4` → selectați zona → se salvează pe desktop
- **Toată pagina**: `Windows + PrtSc` (Windows) sau `Cmd + Shift + 3` (Mac)

**Ce să includeți în captură:**
- Mesajul de eroare complet
- URL-ul din bara de adresă
- Starea formularului/paginii când apare eroarea

---

### Unde să raportați

#### Pentru probleme legate de concedii, solduri, politici:

**Contactați departamentul HR**

- Prin email intern la adresa HR
- Personal, la biroul HR
- Prin sistemul intern de ticketing (dacă există)

**Exemple de probleme pentru HR:**
- Soldul de zile pare incorect
- Nu am acces la un anumit tip de concediu
- Cererea mea este blocată de prea mult timp
- Am nevoie de o excepție de la politică

#### Pentru probleme tehnice (erori, blocaje, autentificare):

**Contactați echipa de suport IT**

- Prin email la adresa IT Support
- Prin sistemul de ticketing IT
- Prin telefon pentru urgențe

**Exemple de probleme pentru IT:**
- Nu mă pot autentifica
- Apare o eroare în aplicație
- Pagina nu se încarcă
- Funcția X nu funcționează

---

### Timp de răspuns estimat

| Prioritate | Descriere | Timp de răspuns |
|------------|-----------|-----------------|
| **Urgentă** | Nu pot lucra deloc (blocat complet) | În aceeași zi lucrătoare |
| **Ridicată** | Funcționalitate importantă nu merge | 1 zi lucrătoare |
| **Medie** | Problemă care are soluție alternativă | 2-3 zile lucrătoare |
| **Scăzută** | Întrebări generale, îmbunătățiri | 3-5 zile lucrătoare |

**Sfaturi pentru răspuns mai rapid:**

1. Includeți toate informațiile necesare de la început
2. Atașați capturi de ecran relevante
3. Descrieți clar pașii care duc la problemă
4. Menționați dacă este urgentă și de ce

---

## Contact Suport

### Departamentul HR

**Pentru:**
- Întrebări despre politicile de concediu
- Probleme cu soldul de zile
- Activarea conturilor pentru angajați noi
- Ajustări și excepții
- Documentație și adeverințe

**Când să contactați:**
- Soldul afișat nu corespunde așteptărilor
- Aveți nevoie de o cerere specială
- Nu înțelegeți o politică de concediu
- Trebuie să modificați o cerere în desfășurare

### Echipa de Suport IT

**Pentru:**
- Probleme de autentificare
- Erori tehnice în aplicație
- Pagini care nu se încarcă
- Probleme de performanță
- Resetarea parolei Microsoft

**Când să contactați:**
- Nu vă puteți autentifica
- Aplicația afișează erori
- Funcționalitățile nu răspund
- Aveți probleme cu browser-ul

### Înainte de a contacta suportul

Încercați următoarele:

1. ✅ Reîncărcați pagina (`F5`)
2. ✅ Ștergeți cache-ul browser-ului
3. ✅ Încercați în modul incognito
4. ✅ Încercați un browser diferit
5. ✅ Verificați conexiunea la internet
6. ✅ Consultați acest ghid de depanare

Dacă problema persistă după acești pași, contactați suportul cu informațiile detaliate.

---

## Resurse Suplimentare

Pentru mai multe informații, consultați celelalte ghiduri din documentație:

- [Ghid de Pornire](01-ghid-de-pornire.md) - Introducere și primii pași
- [Funcționalități](02-functionalitati.md) - Descrierea detaliată a funcționalităților
- [Întrebări Frecvente](03-intrebari-frecvente.md) - Răspunsuri la întrebări comune

---

*Documentație actualizată pentru versiunea curentă a aplicației.*
