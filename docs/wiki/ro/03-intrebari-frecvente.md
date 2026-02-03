# Întrebări Frecvente (FAQ)

Acest document conține răspunsuri la cele mai comune întrebări despre sistemul de gestionare a concediilor. Dacă nu găsiți răspunsul căutat, contactați departamentul HR sau suportul IT.

---

## Cuprins

1. [Autentificare și Acces](#autentificare-și-acces)
2. [Gestionarea Cererilor](#gestionarea-cererilor)
3. [Solduri și Calculări](#solduri-și-calculări)
4. [Aprobări și Flux de Lucru](#aprobări-și-flux-de-lucru)
5. [Calendar și Planificare](#calendar-și-planificare)
6. [Aspecte Tehnice](#aspecte-tehnice)

---

## Autentificare și Acces

### 1. Mi-am uitat parola. Cum o pot reseta?

Sistemul utilizează autentificarea Microsoft (Azure AD), deci **nu există o parolă separată** pentru aplicație.

**Pentru a reseta parola:**

1. Accesați portalul Microsoft la [account.microsoft.com](https://account.microsoft.com) sau [aka.ms/sspr](https://aka.ms/sspr)
2. Faceți clic pe **"Am uitat parola"** sau **"Forgot password"**
3. Introduceți adresa de email a companiei
4. Urmați pașii de verificare (email, telefon sau aplicație authenticator)
5. Creați o parolă nouă respectând cerințele de securitate

> **Important**: Dacă contul dvs. Microsoft este blocat sau nu puteți accesa opțiunile de resetare, contactați departamentul IT al companiei pentru asistență.

---

### 2. Am trimis o cerere dar nu o găsesc în sistem. Ce fac?

Există mai multe motive pentru care o cerere ar putea să nu fie vizibilă:

**Verificați următoarele:**

1. **Cererea a fost trimisă cu succes?**
   - După trimitere, ar fi trebuit să vedeți un mesaj de confirmare
   - Verificați dacă ați primit email de confirmare

2. **Filtrele sunt corecte?**
   - În lista de cereri, asigurați-vă că filtrul de status include "Toate" sau "În Așteptare"
   - Verificați că anul selectat este corect

3. **Verificați paginarea:**
   - Cererile sunt paginate - navigați prin pagini pentru a o localiza
   - Cererile sunt ordonate de la cea mai recentă

4. **Conexiunea la internet:**
   - Dacă aveți probleme de conexiune, cererea poate să nu fi fost transmisă
   - Încercați să reîncărcați pagina (F5 sau Ctrl+R)

**Dacă problema persistă:**
- Verificați cu managerul dvs. dacă a primit notificare despre cerere
- Contactați HR pentru a verifica în sistem
- Raportați problema la suportul IT cu detalii despre dată și oră

---

### 3. Cum pot modifica o cerere deja trimisă?

**Sistemul nu permite modificarea directă a cererilor trimise** pentru a menține integritatea fluxului de aprobare și a jurnalului de audit.

**Procedura recomandată:**

1. **Anulați cererea existentă** (dacă este posibil):
   - Accesați dashboard-ul personal
   - Găsiți cererea în lista "Recent Requests"
   - Apăsați butonul "Cancel" (X)
   - Confirmați anularea

2. **Creați o cerere nouă** cu informațiile corecte

**Când puteți anula:**
- Cererea este în stare "Pending" (neaprobată)
- Cererea este aprobată dar concediul NU a început încă

**Când NU puteți anula:**
- Concediul este în desfășurare
- Cererea a fost deja respinsă sau anulată

> **Notă**: Pentru situații speciale (de exemplu, trebuie să modificați un concediu în desfășurare), contactați departamentul HR.

---

## Gestionarea Cererilor

### 4. Managerul meu este în concediu. Cine îmi aprobă cererea?

Sistemul gestionează automat această situație prin **delegare** sau **escaladare**:

**Scenariu 1: Managerul a configurat un delegat**
- Cererea este trimisă automat către colegul desemnat ca delegat
- Delegatul are aceleași drepturi de aprobare ca și managerul
- Veți vedea în istoricul cererii cine a efectuat aprobarea

**Scenariu 2: Nu există delegat configurat**
- După **3 zile lucrătoare** (interval configurabil), cererea este escaladată automat
- Ordinea de escaladare: Director de departament → Executive → HR
- Veți primi notificare când cererea este escaladată

**Ce puteți face:**
- Așteptați procesul automat de escaladare
- Pentru urgențe, contactați HR care poate aproba manual sau accelera procesul
- Verificați în aplicație dacă managerul are configurat un delegat

---

### 5. Am trimis cererea de concediu, dar am primit respingere. Cum aflu motivul?

**Motivul respingerii este întotdeauna comunicat:**

1. **În aplicație:**
   - Accesați cererea respinsă din lista "Recent Requests"
   - Faceți clic pe cerere pentru a vedea detaliile
   - Secțiunea "Comments" sau "Reason" conține explicația managerului

2. **Pe email:**
   - Veți primi un email de notificare cu statusul "Respins"
   - Motivul este inclus în corpul emailului

**Motive comune pentru respingere:**
- Conflicte cu alți colegi din echipă în aceeași perioadă
- Perioadă critică de proiect sau deadline important
- Sold insuficient de zile
- Documentație lipsă (pentru concedii care necesită documente)
- Nu a fost desemnat un înlocuitor

**Ce puteți face după respingere:**
- Discutați cu managerul pentru a înțelege mai bine situația
- Propuneți o perioadă alternativă
- Trimiteți o cerere nouă cu ajustările necesare

---

### 6. Pot trimite cereri de concediu retroactiv (pentru date din trecut)?

**Da, sistemul permite cereri retroactive** în anumite limite:

**Situații acceptate:**
- Concediu medical neplanificat - puteți trimite cererea după revenire, cu certificat medical
- Urgențe familiale - concediu pentru deces, naștere, etc.
- Erori administrative - corectarea înregistrărilor cu aprobarea HR

**Procedura:**
1. Creați cererea selectând datele din trecut
2. Adăugați în secțiunea "Motiv" explicația pentru întârziere
3. Atașați documentele justificative (obligatoriu pentru medical)
4. Trimiteți cererea pentru aprobare

**Limitări:**
- Cererile retroactive pot necesita aprobări suplimentare
- HR poate solicita explicații pentru întârziere
- Pentru perioade mai vechi de 30 de zile, contactați HR direct

> **Recomandare**: Trimiteți cererile cât mai curând posibil, chiar și pentru situații de urgență.

---

### 7. Ce se întâmplă cu zilele de concediu nefolosite la sfârșitul anului?

Regulile de transfer (carryover) variază în funcție de tipul de concediu:

| Tip Concediu | Se Transferă? | Limită Transfer | Termen Utilizare |
|--------------|---------------|-----------------|------------------|
| **Concediu de Odihnă** | ✅ Da | Max 5 zile | Până la 31 martie anul următor |
| **Concediu Medical** | ❌ Nu | - | Nu se acumulează |
| **Concedii Speciale** | ❌ Nu | - | Trebuie folosite în an |
| **Zile WFH** | ❌ Nu | - | Se resetează lunar |

**Procesul de transfer automat:**

1. La **1 ianuarie**, sistemul calculează automat zilele transferabile
2. Se aplică limita maximă (5 zile pentru concediu de odihnă)
3. Zilele care depășesc limita **sunt pierdute**
4. Veți primi notificare despre noul sold

**Exemplu:**
- Sold la 31 decembrie: 8 zile nefolosite
- Limită transfer: 5 zile
- Sold la 1 ianuarie: 5 zile transferate + noua alocare anuală
- Zile pierdute: 3

> **Sfat**: Planificați-vă concediile pe tot parcursul anului pentru a evita pierderea zilelor.

---

## Solduri și Calculări

### 8. Cum se calculează soldul de zile pentru angajații noi?

Pentru angajații care încep în cursul anului, se aplică calculul **pro-rata**:

**Formula de calcul:**
```
Zile acordate = (Zile anuale complete × Luni rămase în an) / 12
```

**Exemplu:**
- Angajare: 1 iulie
- Drept anual: 21 zile
- Luni rămase: 6 (iulie - decembrie)
- Calcul: (21 × 6) / 12 = **10.5 zile** (rotunjit la 11)

**Particularități:**
- Calculul se face automat la importul angajatului
- Luna de angajare este inclusă integral
- Fracțiunile se rotunjesc în favoarea angajatului
- HR poate ajusta manual în cazuri speciale

**Verificare sold:**
- Accesați dashboard-ul personal
- Cardurile din partea de sus afișează soldul actual
- Tooltip-ul afișează detaliile calculului

---

### 9. Când se resetează soldul de zile de concediu?

**Resetarea anuală are loc la 1 ianuarie:**

**Ce se întâmplă automat:**

1. **Solduri noi** - Se acordă noua alocare anuală completă
2. **Transfer zile** - Zilele eligibile pentru transfer sunt adăugate (max 5)
3. **Reset contoare** - Concediile medicale și speciale pornesc de la 0
4. **Notificări** - Primiți email cu noul sold

**Calendarul procesului:**
- **1 ianuarie, ora 00:00**: Rulează procesul automat de rollover
- **Primele zile ale anului**: HR verifică și ajustează dacă este necesar
- **15 ianuarie**: Deadline pentru contestații sau corecții

**Unde verificați noul sold:**
- Dashboard personal - cardurile de sold
- Email de notificare "New Year Leave Balance"
- HR poate furniza un raport detaliat la cerere

---

### 10. De ce este soldul meu diferit de ce am calculat eu?

Mai mulți factori pot afecta soldul afișat:

**Verificați următoarele:**

1. **Cereri în așteptare:**
   - Zilele din cereri neaprobate sunt rezervate ca "Pending"
   - Formula: Disponibil = Acordat - Folosit - Pending

2. **Calcul pro-rata:**
   - Pentru angajații noi, soldul este proporțional cu luna de angajare
   - Verificați data de angajare în sistem

3. **Ajustări manuale:**
   - HR poate ajusta solduri pentru corecții sau cazuri speciale
   - Verificați jurnalul de audit pentru modificări

4. **Transfer din anul precedent:**
   - Verificați dacă zilele transferate sunt incluse corect
   - Limita maximă de transfer este 5 zile

5. **Tipuri de concediu:**
   - Asigurați-vă că verificați tipul corect de concediu
   - Fiecare tip are sold separat

**Pentru clarificări:**
- Contactați HR cu o captură de ecran a soldului afișat
- Specificați calculul pe care l-ați făcut
- HR poate furniza un raport detaliat al tuturor mișcărilor

---

## Aprobări și Flux de Lucru

### 11. Cum configurez delegarea aprobărilor când sunt în concediu?

**Pași pentru configurarea delegării:**

1. **Accesați Manager Dashboard**
2. **Navigați la secțiunea "Delegation"** sau "Settings"
3. **Apăsați "Create Delegation"**
4. **Completați formularul:**
   - **Delegat**: Selectați colegul care va prelua aprobările
   - **Data început**: Când începe delegarea
   - **Data sfârșit**: Când se termină (opțional)
   - **Motiv**: Concediu, delegație, etc.
5. **Salvați delegarea**

**Cine poate fi delegat:**
- Alți manageri din companie
- Utilizatori cu rol HR sau Executive
- NU puteți delega către subordonații dvs. direcți

**Recomandări:**
- Configurați delegarea **înainte** de a pleca în concediu
- Informați echipa cine va gestiona aprobările
- Verificați că delegatul este disponibil în perioada respectivă

**Gestionarea delegărilor:**
- Vizualizați delegările active în "My Delegations"
- Puteți anula o delegare oricând
- Delegatul primește notificare automată

---

## Calendar și Planificare

### 12. Cum văd calendarul echipei pentru a planifica concediul?

**Metoda 1: Din formularul de cerere**

1. Când creați o cerere nouă de concediu
2. Apăsați butonul **"Check Team Conflicts"**
3. Veți vedea:
   - Colegii în concediu în perioada selectată
   - Colegii disponibili pentru înlocuire
   - Conflicte potențiale

**Metoda 2: Calendarul echipei**

1. **Pentru angajați:**
   - Din Employee Dashboard → "Team Calendar"

2. **Pentru manageri:**
   - Din Manager Dashboard → tab-ul "Calendar"

3. **Funcționalități calendar:**
   - Comutați între vizualizare lună/săptămână
   - Filtrați după departament
   - Faceți clic pe o zi pentru detalii complete

**Legendă culori:**
- 🔴 Roșu: Concedii aprobate
- 🟡 Galben: Cereri în așteptare
- 🔵 Albastru: Lucru de acasă (WFH)
- 🟠 Portocaliu: Sărbători legale

**Statistici afișate:**
- Total membri echipă
- Număr în concediu azi
- Număr lucru de acasă
- Cereri în așteptare

---

## Aspecte Tehnice

### 13. Pot folosi aplicația de pe telefon?

**Da, aplicația este responsive și funcționează pe dispozitive mobile.**

**Funcționalități disponibile pe mobil:**

✅ **Complet funcționale:**
- Vizualizarea soldului de zile
- Trimiterea cererilor de concediu
- Vizualizarea statusului cererilor
- Aprobarea/respingerea cererilor (manageri)
- Notificări și alerte
- Calendarul echipei

⚠️ **Experiență optimizată pentru desktop:**
- Rapoarte și analize detaliate
- Export date (CSV, Excel, PDF)
- Formulare complexe cu multe câmpuri

**Recomandări pentru utilizare mobilă:**
- Folosiți browser-ul în modul landscape pentru formulare
- Pinch-to-zoom pentru tabele mai mari
- Salvați aplicația ca shortcut pe ecranul principal

**Cum adăugați shortcut (Android):**
1. Deschideți aplicația în Chrome
2. Meniu (⋮) → "Add to Home screen"

**Cum adăugați shortcut (iOS):**
1. Deschideți aplicația în Safari
2. Share (↑) → "Add to Home Screen"

---

### 14. Cum export rapoartele în Excel sau PDF?

**Opțiuni de export disponibile:**

**Export CSV (disponibil pentru toți utilizatorii cu acces):**

1. Navigați la secțiunea dorită (Analytics, Employees, Audit Logs)
2. Apăsați butonul **"Export"** sau **"Download CSV"**
3. Fișierul se descarcă automat
4. Deschideți în Excel sau Google Sheets

**Export Excel (XLSX) - doar Admin:**

1. Accesați Admin Panel → Users
2. Apăsați "Export Users"
3. Se descarcă fișierul cu multiple foi de lucru

**Export PDF - doar HR:**

1. Accesați HR Dashboard → Analytics
2. Apăsați "Export PDF"
3. Se generează raport formatat pentru imprimare

**Denumiri fișiere:**
- `employees_YYYY-MM-DD.csv`
- `audit-logs-YYYY-MM-DD.csv`
- `department-summary-YYYY-MM-DD.csv`
- `users_export_YYYY-MM-DD.xlsx`

**Sfaturi:**
- Aplicați filtre înainte de export pentru date relevante
- Exporturile mari pot dura câteva secunde
- Verificați folderul Downloads dacă nu găsiți fișierul

---

### 15. Am primit o eroare în aplicație. Ce trebuie să fac?

**Pași de urmat pentru rezolvarea erorilor:**

**1. Notați detaliile erorii:**
- Mesajul de eroare exact (faceți captură de ecran)
- Ce acțiune încercați să efectuați
- Data și ora când a apărut eroarea
- Browser-ul și dispozitivul folosit

**2. Încercați soluții rapide:**
- **Reîncărcați pagina** (F5 sau Ctrl+R)
- **Ștergeți cache-ul browser-ului** (Ctrl+Shift+Delete)
- **Încercați alt browser** (Chrome, Firefox, Edge)
- **Deconectați-vă și reconectați-vă**

**3. Verificați conexiunea:**
- Testați conexiunea la internet
- Încercați să accesați alte site-uri
- Dacă folosiți VPN, încercați fără VPN (sau invers)

**4. Erori comune și soluții:**

| Eroare | Cauză probabilă | Soluție |
|--------|-----------------|---------|
| "Session expired" | Sesiune expirată | Reconectați-vă |
| "Network error" | Problemă de conexiune | Verificați internetul |
| "403 Forbidden" | Lipsă permisiuni | Contactați HR/Admin |
| "500 Server Error" | Eroare de server | Așteptați și reîncercați |
| "Failed to load" | Cache corupt | Ștergeți cache-ul |

**5. Dacă problema persistă:**
- Contactați **Suportul IT** cu:
  - Captura de ecran a erorii
  - Descrierea pașilor care duc la eroare
  - Browser și sistem de operare
  - Data și ora

---

### 16. Cum contactez suportul tehnic?

**Canale de contact disponibile:**

**Pentru întrebări despre politici, solduri sau acces:**
- 📧 **Email HR**: Trimiteți email la departamentul HR al companiei
- 📍 **Personal**: Vizitați biroul HR în timpul programului

**Pentru probleme tehnice de autentificare sau erori:**
- 📧 **Email IT**: Trimiteți email la echipa de suport IT
- 🎫 **Sistem ticketing**: Dacă există, deschideți un ticket IT

**Informații de inclus în solicitare:**

Pentru HR:
- Numele și departamentul dvs.
- Descrierea problemei
- Capturi de ecran relevante

Pentru IT:
- Numele și email-ul dvs.
- Browser și versiune (ex: Chrome 120)
- Sistem de operare (ex: Windows 11)
- Descrierea detaliată a problemei
- Pași pentru reproducere
- Capturi de ecran cu eroarea

**Timp de răspuns estimat:**
- Urgențe (blocat complet): În aceeași zi lucrătoare
- Probleme standard: 1-2 zile lucrătoare
- Întrebări generale: 2-3 zile lucrătoare

---

### 17. Cum pot vedea jurnalul de activitate pentru cererile mele?

**Fiecare cerere are un istoric complet de acțiuni:**

**Pentru a vizualiza istoricul:**

1. Accesați cererea din lista "Recent Requests"
2. Faceți clic pe cerere pentru a deschide detaliile
3. Secțiunea "Activity" sau "History" afișează:
   - Data și ora creării
   - Când a fost trimisă pentru aprobare
   - Cine a primit cererea
   - Când și cine a aprobat/respins
   - Comentariile adăugate
   - Modificări de status

**Ce informații sunt înregistrate:**
- Toate schimbările de status
- Acțiunile tuturor participanților
- Escaladările automate
- Anulările și motivele

**Pentru rapoarte de audit complete:**
- Contactați HR sau Admin
- Pot furniza export detaliat din Audit Logs

---

### 18. De ce nu pot selecta anumite zile în calendar când creez o cerere?

**Zilele blocate pentru selecție au motive specifice:**

| Indicator | Motiv | Acțiune |
|-----------|-------|---------|
| ⚫ **Gri** | Weekend-uri | Nu se numără în concediu |
| ⚫ **Gri** | Date din trecut (pentru anumite tipuri) | Contactați HR |
| 🟣 **Mov** | Sărbătoare legală | Nu consumă zile de concediu |
| 🔴 **Roșu** | Aveți deja concediu aprobat | Anulați mai întâi concediul existent |
| 🟡 **Galben** | Cerere în așteptare | Așteptați sau anulați cererea |

**Cazuri speciale:**

**Pentru WFH (lucru de acasă):**
- Săptămâna curentă poate fi blocată
- Unele zile pot avea restricții specifice companiei

**Pentru concediu medical:**
- Poate necesita date consecutive
- Verificați cerințele documentului medical

**Dacă o zi ar trebui să fie disponibilă dar nu este:**
- Reîncărcați pagina
- Verificați soldul disponibil
- Contactați HR pentru clarificări

---

## Întrebări Suplimentare

### 19. Pot vedea cererile de concediu ale colegilor mei?

**Vizibilitatea depinde de rolul dvs.:**

| Rol | Ce puteți vedea |
|-----|-----------------|
| **Angajat** | Calendarul echipei (cine este absent, fără detalii) |
| **Manager** | Cererile subordonaților direcți cu detalii complete |
| **HR** | Toate cererile din companie |
| **Executive** | Cereri escalate și rapoarte agregate |

**Informații din calendarul echipei:**
- Numele colegilor absenți
- Tipul de absență (concediu, WFH)
- Perioada absenței

**Nu puteți vedea:**
- Motivul detaliat al concediului altor colegi (confidențial)
- Documentele medicale ale altora
- Comentariile private din aprobare

---

### 20. Cât de repede primesc răspuns la cererea de concediu?

**Timpii standard de procesare:**

| Situație | Timp estimat |
|----------|--------------|
| Cerere standard | 1-3 zile lucrătoare |
| Manager absent cu delegat | 1-3 zile lucrătoare |
| Manager absent fără delegat | 3-5 zile (cu escaladare) |
| Cerere urgentă (escaladă) | 1-2 zile după escaladare |

**Factori care influențează timpul:**
- Disponibilitatea managerului
- Volumul de cereri în așteptare
- Complexitatea cererii (perioade lungi, documente necesare)
- Perioada din an (vacanțe = timpi mai lungi)

**Ce puteți face pentru a accelera:**
- Trimiteți cererea cu suficient timp înainte
- Asigurați-vă că ați completat toate informațiile
- Pentru urgențe, contactați managerul direct sau HR

---

## Nu ați găsit răspunsul?

Dacă întrebarea dvs. nu este acoperită în acest FAQ:

1. **Consultați documentația completă:**
   - [Ghid de Pornire](01-ghid-de-pornire.md) - Pentru început rapid
   - [Funcționalități](02-functionalitati.md) - Pentru detalii complete

2. **Contactați suportul:**
   - **HR** - Pentru întrebări despre politici și proceduri
   - **IT** - Pentru probleme tehnice

3. **Sugerați o întrebare nouă:**
   - Dacă întrebarea dvs. ar putea ajuta și alți colegi, sugerați adăugarea ei în FAQ contactând HR

---

*Documentație actualizată pentru versiunea curentă a aplicației.*
