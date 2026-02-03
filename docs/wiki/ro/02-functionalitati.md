# Funcționalități ale Aplicației

Acest ghid documentează în detaliu toate funcționalitățile disponibile în sistemul de gestionare a concediilor. Veți găsi instrucțiuni pas cu pas pentru fiecare caracteristică.

---

## Cuprins

1. [Gestionarea Concediilor](#gestionarea-concediilor)
   - [Tipuri de Concedii](#tipuri-de-concedii)
   - [Solicitarea unui Concediu](#solicitarea-unui-concediu)
   - [Anularea unui Concediu](#anularea-unui-concediu)
   - [Modificarea unei Cereri](#modificarea-unei-cereri)
   - [Istoricul Cererilor](#istoricul-cererilor)
2. [Fluxul de Aprobare](#fluxul-de-aprobare)
   - [Cum Funcționează Aprobarea](#cum-funcționează-aprobarea)
   - [Aprobarea Cererilor](#aprobarea-cererilor)
   - [Respingerea Cererilor](#respingerea-cererilor)
   - [Delegarea Aprobărilor](#delegarea-aprobărilor)
   - [Escaladarea Automată](#escaladarea-automată)
   - [Aprobarea între Executivi](#aprobarea-între-executivi)
3. [Rapoarte și Export](#rapoarte-și-export)
   - [Rapoarte Disponibile](#rapoarte-disponibile)
   - [Generarea Rapoartelor](#generarea-rapoartelor)
   - [Exportul Datelor](#exportul-datelor)
4. [Calendar](#calendar)
   - [Calendarul Echipei](#calendarul-echipei)
   - [Calendarul Personal](#calendarul-personal)
   - [Integrarea cu Outlook](#integrarea-cu-outlook)
5. [Notificări](#notificări)
   - [Tipuri de Notificări](#tipuri-de-notificări)
   - [Configurarea Notificărilor](#configurarea-notificărilor)

---

## Gestionarea Concediilor

### Tipuri de Concedii

Sistemul oferă 10 tipuri distincte de concedii, fiecare cu reguli și limite specifice:

| Tip Concediu | Cod | Zile/An | Transfer An Următor | Document Necesar | Verificare HR | Max Zile/Cerere |
|--------------|-----|---------|---------------------|------------------|---------------|-----------------|
| **Concediu de Odihnă** | NL | 21 | Da (max 5) | Nu | Nu | 14 |
| **Concediu Medical** | SL | 180 | Nu | Da (certificat medical) | Da | 30 |
| **Concediu Paternal** | PAT | 5 | Nu | Da (certificat naștere) | Da | 5 |
| **Concediu Maternal** | MAT | 126 | Nu | Da (medical/naștere) | Da | 126 |
| **Concediu Căsătorie** | MARR | 5 | Nu | Da (certificat căsătorie) | Da | 5 |
| **Concediu Deces** | BER | 3 | Nu | Da (certificat deces) | Da | 3 |
| **Concediu Studii** | STD | 10 | Nu | Da (adeverință) | Nu | 5 |
| **Concediu Fără Plată** | UPL | 30 | Nu | Nu | Da | 30 |
| **Concediu Îngrijire Copil** | CCL | 2 | Nu | Nu | Nu | 2 |
| **Concediu Donare Sânge** | BDL | 1 | Nu | Da (adeverință donare) | Nu | 1 |

#### Înțelegerea Soldului de Zile

- **Acordat (Entitled)** - Numărul total de zile la care aveți dreptul
- **Folosit (Used)** - Zilele deja consumate din concedii aprobate
- **În Așteptare (Pending)** - Zilele din cereri încă neaprobate
- **Disponibil (Available)** - Zilele rămase pentru noi cereri

> **Notă**: Pentru angajații noi, soldul se calculează proporțional (pro-rata) în funcție de data angajării.

---

### Solicitarea unui Concediu

#### Pasul 1: Deschideți Formularul de Cerere

1. Din orice pagină a aplicației, apăsați butonul **"+ New Leave Request"** din bara de navigare
2. Se va deschide formularul interactiv de cerere

#### Pasul 2: Selectați Tipul de Concediu

1. În câmpul **"Leave Type"**, alegeți tipul de concediu dorit din lista derulantă
2. În partea dreaptă veți vedea automat:
   - Soldul disponibil pentru tipul selectat
   - Numărul maxim de zile permis per cerere
   - Dacă sunt necesare documente suport

#### Pasul 3: Selectați Datele

1. Folosiți **calendarul interactiv** pentru a selecta zilele dorite
2. Faceți clic pe fiecare zi pe care doriți să o includeți în cerere
3. Puteți selecta:
   - **Zile consecutive** - un interval continuu
   - **Zile individuale** - date non-consecutive pentru flexibilitate maximă
4. Calendarul afișează automat:
   - 🔴 Zilele deja în concediu (roșu)
   - 🟡 Cererile în așteptare (galben)
   - 🟣 Sărbătorile legale (mov) - blocate pentru selecție
   - ⚫ Weekend-urile (gri) - blocate automat

> **Sfat**: Zilele de weekend și sărbătorile legale nu sunt numărate în soldul de concediu.

#### Pasul 4: Completați Detaliile

1. **Motiv** (opțional) - Adăugați o descriere scurtă a motivului concediului
2. **Înlocuitor obligatoriu** - Selectați un coleg care vă va acoperi responsabilitățile:
   - Folosiți butonul **"Check Team Conflicts"** pentru a vedea disponibilitatea echipei
   - Sistemul va sugera colegi disponibili în perioada selectată
3. **Documente suport** (pentru anumite tipuri de concedii):
   - Pentru concediu medical: încărcați certificatul medical
   - Formate acceptate: JPEG, PNG, PDF
   - Dimensiune maximă: 5 MB

#### Pasul 5: Semnați și Trimiteți

1. În secțiunea **"Signature"**, semnați folosind mouse-ul sau touchscreen-ul
2. Semnătura trebuie să conțină cel puțin 2 linii
3. Verificați toate informațiile introduse
4. Apăsați **"Submit Request"** pentru a trimite cererea

#### Ce Se Întâmplă După Trimitere?

1. Cererea primește un număr unic (ex: LR-2024-0001)
2. Zilele solicitate trec în starea **"Pending"** în soldul dvs.
3. Managerul direct primește notificare pentru aprobare
4. Veți primi confirmare pe email și în aplicație
5. Puteți urmări statusul în secțiunea "Recent Requests"

---

### Anularea unui Concediu

Puteți anula cererile de concediu în anumite condiții:

#### Când Puteți Anula

| Status Cerere | Puteți Anula? | Condiții |
|---------------|---------------|----------|
| **În Așteptare (Pending)** | ✅ Da | Oricând înainte de aprobare |
| **Aprobat (Approved)** | ✅ Da | Doar dacă NU a început încă |
| **În Desfășurare** | ❌ Nu | Contactați HR |
| **Respins (Rejected)** | ❌ Nu | Nu este necesar |
| **Anulat (Cancelled)** | ❌ Nu | Deja anulat |

#### Pași pentru Anulare

1. Accesați dashboard-ul personal (**Employee Dashboard**)
2. În secțiunea **"Recent Requests"**, localizați cererea dorită
3. Apăsați butonul **"Cancel"** (X) din dreptul cererii
4. Confirmați anularea în dialogul care apare
5. Opțional, adăugați un motiv pentru anulare

#### După Anulare

- Statusul cererii devine **"Cancelled"**
- Zilele sunt restaurate automat în soldul disponibil
- Managerul și HR primesc notificare despre anulare
- Se creează o înregistrare în jurnalul de audit

---

### Modificarea unei Cereri

> **Important**: Sistemul nu permite modificarea directă a cererilor trimise.

Dacă trebuie să modificați datele, tipul de concediu sau alte detalii ale unei cereri deja trimise:

#### Procedura Recomandată

1. **Anulați** cererea existentă (dacă este posibil - vezi secțiunea de anulare)
2. **Creați o cerere nouă** cu informațiile corecte

Această abordare asigură:
- Integritatea fluxului de aprobare
- Un audit trail complet și transparent
- Claritate pentru toți participanții în proces

---

### Istoricul Cererilor

Vizualizați toate cererile dvs. de concediu din secțiunea "Recent Requests" sau "Leave History".

#### Accesarea Istoricului

1. Din **Employee Dashboard**, vedeți ultimele cereri în secțiunea principală
2. Pentru istoric complet, folosiți filtrele disponibile:
   - **Status**: Toate, În Așteptare, Aprobate, Respinse, Anulate
   - **An**: Anul curent sau "Toate" pentru istoric complet

#### Informații Afișate pentru Fiecare Cerere

- **Număr cerere** (ex: LR-2024-0001)
- **Tip concediu** cu badge colorat
- **Perioada** - format inteligent:
  - O singură zi: "Marți, 15 Februarie 2024"
  - Interval în aceeași lună: "15 - 17 Februarie 2024"
  - Interval între luni: "15 Feb - 5 Mar 2024"
- **Număr zile** lucrătoare
- **Status** cu indicator vizual:
  - 🟢 Verde: Aprobat
  - 🟡 Galben: În Așteptare
  - 🔴 Roșu: Respins
  - ⚫ Gri: Anulat
- **Buton de anulare** (când este disponibil)

#### Navigarea în Istoric

- Istoricul este paginat (5 cereri per pagină)
- Folosiți butoanele de navigare pentru a vedea cereri mai vechi
- Cererile sunt ordonate cronologic (cele mai recente primele)

---

## Fluxul de Aprobare

### Cum Funcționează Aprobarea

Sistemul utilizează un flux de aprobare pe mai multe niveluri, configurat în funcție de rolul solicitantului și tipul de concediu.

#### Lanțuri de Aprobare Standard

| Rol Solicitant | Niveluri de Aprobare |
|----------------|---------------------|
| **Angajat** | Manager direct |
| **Manager** | Director de departament sau Executive |
| **Director Departament** | Executive |
| **HR** | Manager HR |
| **Executive** | Alt Executive (aprobare de la egal) |

#### Cazuri Speciale

- **Concediu Medical (SL)**: Necesită verificare HR obligatorie pentru documentele medicale
- **Concedii Speciale**: Pot necesita aprobări suplimentare de la HR
- **Cereri > 10 zile**: Pot fi escalate automat la niveluri superioare

---

### Aprobarea Cererilor

#### Pentru Manageri

1. Accesați **Manager Dashboard**
2. În secțiunea **"Pending Team Approvals"** vedeți cererile în așteptare
3. Pentru fiecare cerere puteți vedea:
   - Numele angajatului și departamentul
   - Tipul și perioada concediului
   - Numărul de zile solicitate
   - Înlocuitorul desemnat
4. Apăsați butonul **"Approve"** (✓) pentru a aproba
5. Opțional, adăugați un comentariu de aprobare
6. Confirmați acțiunea

#### Ce Se Întâmplă La Aprobare

1. Statusul cererii devine **"Approved"**
2. Zilele trec din **"Pending"** în **"Used"** în soldul angajatului
3. Angajatul primește notificare pe email și în aplicație
4. Înlocuitorul desemnat primește email cu detaliile sarcinilor
5. Se generează automat documentul de concediu (dacă este configurat)
6. Se adaugă semnătura digitală pe document

---

### Respingerea Cererilor

#### Pentru Manageri

1. Din **Manager Dashboard**, în secțiunea de cereri în așteptare
2. Apăsați butonul **"Deny"** (✗) pentru cererea respectivă
3. **Obligatoriu**: Introduceți motivul respingerii
4. Confirmați respingerea

#### După Respingere

- Statusul cererii devine **"Rejected"**
- Zilele sunt restaurate automat în soldul disponibil al angajatului
- Angajatul primește notificare cu motivul respingerii
- Se creează înregistrare în jurnalul de audit

---

### Delegarea Aprobărilor

Când sunteți indisponibil (în concediu, delegație, etc.), puteți delega autoritatea de aprobare unui coleg.

#### Crearea unei Delegări

1. Accesați **Manager Dashboard**
2. Navigați la secțiunea **"Delegation"** sau **"Settings"**
3. Apăsați **"Create Delegation"**
4. Completați:
   - **Delegat**: Selectați managerul care va prelua aprobările
   - **Data început**: Când începe delegarea
   - **Data sfârșit**: Când se încheie (opțional pentru delegări pe termen nedeterminat)
   - **Motiv**: De ce delegați (ex: "Concediu", "Delegație")
5. Apăsați **"Create"** pentru a activa delegarea

#### Cine Poate Fi Delegat

- Manageri din același departament sau alte departamente
- Utilizatori cu rol de Manager, HR sau Executive
- Nu puteți delega către dvs. înșivă

#### Gestionarea Delegărilor

- Vizualizați delegările active în secțiunea "My Delegations"
- Puteți anula o delegare înainte de data de sfârșit
- Delegatul primește notificare când este desemnat

---

### Escaladarea Automată

Sistemul escalează automat cererile nerezolvate pentru a preveni blocajele.

#### Când Are Loc Escaladarea

- Cererea este în așteptare mai mult de **3 zile lucrătoare** (configurabil)
- Aprobatorul curent este în concediu
- Aprobatorul are prea multe cereri în așteptare (>10)

#### Procesul de Escaladare

1. Sistemul verifică periodic cererile în așteptare
2. Pentru cererile eligibile pentru escaladare:
   - Se caută un delegat activ al aprobatorului
   - Dacă nu există delegat, se trece la nivelul următor în lanțul de aprobare
   - Se poate escalada către: Director departament → Executive → HR
3. Noul aprobator primește notificare urgentă
4. Solicitantul este informat despre escaladare

#### Configurarea Escaladării

Setările de escaladare sunt gestionate de HR/Admin:
- Număr zile până la escaladare
- Activare/dezactivare escaladare automată
- Săritrea automată a aprobatorilor absenți
- Număr maxim de niveluri de escaladare

---

### Aprobarea între Executivi

Executivii au un flux special de aprobare pentru propriile cereri de concediu.

#### Cum Funcționează

1. Când un Executive trimite o cerere de concediu
2. Cererea este atribuită **altui Executive** pentru aprobare
3. Ordinea de prioritate pentru atribuire:
   - Managerul direct al executivului (dacă este tot executive)
   - Orice alt executive activ care nu este în concediu
   - Dacă există un singur executive, cererea merge la HR

#### Reguli Importante

- Un Executive **nu poate** aproba propria cerere
- Orice Executive poate aproba cererile altor Executives
- Executives au vizibilitate asupra tuturor cererilor de la peers în dashboard

---

## Rapoarte și Export

### Rapoarte Disponibile

Sistemul oferă mai multe tipuri de rapoarte în funcție de rol:

#### Rapoarte pentru Executives

| Raport | Descriere |
|--------|-----------|
| **Department Summary** | Statistici pe departamente: angajați în concediu, lucru de acasă, cereri în așteptare |
| **Leave Utilization** | Utilizarea concediilor: zile folosite vs. disponibile per departament |
| **Capacity Planning** | Planificarea capacității: disponibilitate echipă, acoperire |
| **Manager Performance** | Performanța managerilor: cereri în așteptare, timpi de răspuns |
| **Full Report** | Raport complet combinând toate secțiunile |

#### Rapoarte pentru HR

| Raport | Descriere |
|--------|-----------|
| **HR Analytics** | Analiză detaliată: tendințe lunare, distribuție departamente |
| **Employee Export** | Lista completă angajați cu solduri de concediu |
| **Audit Logs** | Jurnal de audit: toate acțiunile din sistem |

#### Rapoarte pentru Admin

| Raport | Descriere |
|--------|-----------|
| **Users Export** | Export complet utilizatori cu toate detaliile |
| **Audit Logs Export** | Export jurnal de audit cu filtre |

---

### Generarea Rapoartelor

#### Pentru Executives

1. Accesați **Executive Dashboard** → **Analytics**
2. Vizualizați dashboard-ul cu:
   - Metrici companie (carduri sumare)
   - Grafic distribuție departamente
   - Tendințe lunare
   - Pattern-uri sezoniere
3. Folosiți filtrele pentru a ajusta perioada

#### Pentru HR

1. Accesați **HR Dashboard** → tab-ul **Analytics**
2. Selectați perioada dorită:
   - Luna curentă
   - Luna trecută
   - Ultimele 3/6 luni
   - Anul curent
   - Interval personalizat
3. Vizualizați:
   - Carduri cu statistici cheie
   - Grafic bare pe departamente
   - Grafic tendință lunară
   - Sărbători viitoare
4. Apăsați **"Refresh"** pentru date actualizate

---

### Exportul Datelor

#### Export CSV

Exportul CSV este disponibil pentru majoritatea rapoartelor.

**Pași pentru Export CSV (Executive):**
1. În **Analytics** apăsați meniul **"Export"**
2. Selectați tipul de raport dorit
3. Fișierul CSV se descarcă automat
4. Denumire fișier: `{tip-raport}-{data}.csv` (ex: `department-summary-2024-02-01.csv`)

**Pași pentru Export CSV (HR - Angajați):**
1. În **HR Dashboard** → tab-ul **Employees**
2. Apăsați butonul **"Export"**
3. Se descarcă fișierul `employees_YYYY-MM-DD.csv`

**Conținut Export Angajați:**
- ID Angajat, Nume, Prenume
- Email, Telefon
- Departament, Poziție
- Rol, Status (Activ/Inactiv)
- Data angajării, Manager
- Solduri concedii (Odihnă, Medical, Personal)

#### Export PDF

Exportul PDF este disponibil pentru rapoarte HR:

1. În **HR Dashboard** → **Analytics**
2. Apăsați butonul **"Export PDF"**
3. Se generează un raport HTML/PDF cu:
   - Tabel distribuție departamente
   - Informații sărbători (dacă există)
   - Detalii cereri (primele 50)
   - Footer cu data generării și exportator

#### Export Excel (XLSX)

Disponibil pentru export complet utilizatori (Admin):

1. Accesați **Admin Panel** → **Users**
2. Apăsați **"Export Users"**
3. Se descarcă fișierul `users_export_YYYY-MM-DD.xlsx`

**Conținut Workbook:**
- **Foaia "Users"**: Date complete utilizatori cu coloane optimizate
- **Foaia "Summary"**: Statistici (total, activi/inactivi, per rol, per departament)

#### Export Jurnal Audit

1. Accesați **Admin Panel** → **Audit Logs**
2. Aplicați filtre (opțional):
   - Acțiune (CREATE, UPDATE, DELETE, DATA_EXPORT)
   - Tip entitate (LEAVE_REQUEST, USER, etc.)
   - Interval date
3. Apăsați **"Export"**
4. Se descarcă `audit-logs-YYYY-MM-DD.csv`

---

## Calendar

### Calendarul Echipei

Calendarul echipei oferă o vizualizare completă a disponibilității colegilor.

#### Accesarea Calendarului Echipei

- **Manageri**: Din Manager Dashboard → secțiunea Calendar
- **Angajați**: Din Employee Dashboard → "Team Calendar"
- **Executives**: Din Executive Dashboard → Calendar

#### Funcționalități

**Vizualizări Disponibile:**
- **Vizualizare Lună**: Vedere de ansamblu pe întreaga lună
- **Vizualizare Săptămână**: Detalii pe zile pentru săptămâna selectată

Comutați între vizualizări folosind butoanele "Month" / "Week".

**Afișare Evenimente:**
- 🔴 **Roșu**: Concedii aprobate
- 🟡 **Galben**: Cereri în așteptare
- 🔵 **Albastru**: Lucru de acasă (WFH)
- 🟠 **Portocaliu**: Sărbători legale

**Statistici Echipă:**
În partea de sus a calendarului vedeți:
- Total membri echipă
- Număr în concediu
- Număr lucru de acasă
- Cereri în așteptare

#### Vizualizarea Detaliilor unei Zile

1. Faceți clic pe orice zi din calendar
2. Se deschide un modal cu:
   - Lista colegilor în concediu în acea zi
   - Lista colegilor care lucrează de acasă
   - Sărbătorile legale (dacă există)
   - Motivul concediului (pentru fiecare persoană)
   - Înlocuitorul desemnat
   - Rezumat: Absenți / WFH / În birou

---

### Calendarul Personal

Calendarul personal este integrat în formularul de cerere de concediu.

#### Caracteristici

**Indicatori Vizuali:**
- 🔵 **Albastru**: Zilele selectate pentru cererea curentă
- 🔴 **Roșu**: Concedii deja aprobate
- 🟡 **Galben**: Cereri în așteptare
- 🟣 **Mov**: Sărbători legale (blocate)
- ⚫ **Gri**: Weekend-uri și date trecute (blocate)
- 🟠 **Portocaliu**: Zile când colegi din echipă sunt absenți

**Selecție Flexibilă:**
- Clic pentru a adăuga/elimina zile individuale
- Suport pentru date non-consecutive
- Calculare automată a zilelor lucrătoare

**Pentru Cereri WFH:**
- Săptămâna curentă este blocată
- Se afișează zilele când WFH nu este permis
- Se evidențiază conflictele cu concedii existente

---

### Integrarea cu Outlook

> **Status Curent**: Integrarea cu Outlook/calendare externe **nu este implementată** în versiunea actuală.

Aplicația funcționează ca sistem independent și nu sincronizează cu:
- Microsoft Outlook
- Google Calendar
- Apple Calendar
- Alte sisteme de calendar externe

**Alternative:**
- Vizualizați calendarul echipei direct în aplicație
- Folosiți funcția "Team Calendar" pentru planificare
- Verificați disponibilitatea colegilor înainte de a trimite cereri

---

## Notificări

### Tipuri de Notificări

Sistemul trimite notificări atât în aplicație cât și pe email.

#### Notificări în Aplicație

| Tip | Descriere | Destinatar |
|-----|-----------|------------|
| **📝 LEAVE_REQUESTED** | Cerere nouă de concediu | Manager/Aprobator |
| **✅ LEAVE_APPROVED** | Cerere aprobată | Angajat |
| **❌ LEAVE_REJECTED** | Cerere respinsă | Angajat |
| **🚫 LEAVE_CANCELLED** | Cerere anulată | Manager/HR |
| **⚠️ APPROVAL_REQUIRED** | Acțiune necesară | Aprobator |
| **📄 DOCUMENT_READY** | Document generat | Angajat |
| **🏥 SICK_LEAVE_SUBMITTED** | Concediu medical trimis | HR (toți) |

#### Vizualizarea Notificărilor

1. În colțul din dreapta sus, observați **clopoțelul de notificări**
2. Badge-ul roșu indică numărul de notificări necitite
3. Faceți clic pe clopoțel pentru a vedea lista
4. Fiecare notificare afișează:
   - Pictogramă specifică tipului
   - Titlu și mesaj
   - Timp de la primire (ex: "acum 5 minute")
5. Faceți clic pe o notificare pentru a:
   - O marca ca citită
   - Naviga la pagina relevantă

#### Acțiuni Disponibile

- **"Mark all read"** - Marchează toate notificările ca citite
- **"View all"** - Vezi lista completă de notificări
- **Ștergere individuală** - Butonul X de pe fiecare notificare

#### Notificări Email

Sistemul trimite automat email-uri pentru:

1. **Cerere Nouă de Concediu**
   - Destinatar: Manager
   - Conține: Detalii cerere, butoane Aprobare/Respingere
   - Limba: Română

2. **Aprobare/Respingere**
   - Destinatar: Angajat
   - Conține: Status, comentarii manager (dacă există)
   - Stilizare verde (aprobare) sau roșu (respingere)

3. **Escaladare**
   - Destinatar: Noul aprobator
   - Conține: Alertă urgentă, motiv escaladare
   - Formatare cu avertizare vizuală

4. **Desemnare Înlocuitor**
   - Destinatar: Colegul desemnat ca înlocuitor
   - Conține: Perioada, responsabilități, contact

5. **Bun Venit**
   - Destinatar: Angajat nou
   - Conține: Instrucțiuni de conectare, credențiale temporare

---

### Configurarea Notificărilor

#### Setări Curente

În versiunea actuală, notificările sunt trimise automat fără opțiuni de configurare per utilizator.

**Comportament Standard:**
- Toate notificările în aplicație sunt active
- Email-urile sunt trimise pentru evenimente importante
- Notificările citite sunt șterse automat după 30 de zile

#### Setări la Nivel de Companie (Admin)

Administratorii pot configura:
- **Zile până la escaladare**: Implicit 3 zile lucrătoare
- **Escaladare automată**: Activată/dezactivată
- **Săritrea aprobatorilor absenți**: Activată/dezactivată
- **Fus orar companie**: Pentru calculul zilelor lucrătoare

---

## Suport și Asistență

Pentru întrebări sau probleme:

- **Departamentul HR** - Întrebări despre politici, solduri, acces
- **Suport IT** - Probleme tehnice de autentificare sau erori

---

*Documentație actualizată pentru versiunea curentă a aplicației.*
