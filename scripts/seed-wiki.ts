import { PrismaClient, WikiPageStatus, Role } from '@prisma/client'

const prisma = new PrismaClient()

// Tiptap JSON helpers
function p(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function heading(text: string, level: number = 2) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function bold(text: string) {
  return { type: 'text', marks: [{ type: 'bold' }], text }
}

function pWithBold(before: string, boldText: string, after: string = '') {
  const content: any[] = []
  if (before) content.push({ type: 'text', text: before })
  content.push(bold(boldText))
  if (after) content.push({ type: 'text', text: after })
  return { type: 'paragraph', content }
}

function bulletList(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [p(item)],
    })),
  }
}

function orderedList(items: string[]) {
  return {
    type: 'orderedList',
    attrs: { start: 1 },
    content: items.map(item => ({
      type: 'listItem',
      content: [p(item)],
    })),
  }
}

function hr() {
  return { type: 'horizontalRule' }
}

function blockquote(text: string) {
  return { type: 'blockquote', content: [p(text)] }
}

function doc(...content: any[]) {
  return { type: 'doc', content }
}

function extractPlainText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  let text = ''
  if (node.text) text += node.text
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractPlainText(child)
      if (['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'horizontalRule'].includes(child.type)) {
        text += '\n'
      }
    }
  }
  return text
}

async function main() {
  // Find HR user as author
  const hrUser = await prisma.user.findFirst({ where: { role: 'HR' }, select: { id: true } })
  if (!hrUser) throw new Error('No HR user found')
  const authorId = hrUser.id

  console.log('Creating categories...')

  const catGeneral = await prisma.wikiCategory.create({
    data: { name: 'General', nameEn: 'General', nameRo: 'General', slug: 'general', icon: '📖', sortOrder: 1, description: 'Informații generale despre aplicație' },
  })

  const catAngajat = await prisma.wikiCategory.create({
    data: { name: 'Angajat', nameEn: 'Employee Guide', nameRo: 'Ghid Angajat', slug: 'ghid-angajat', icon: '👤', sortOrder: 2, description: 'Ghid pentru angajați' },
  })

  const catManager = await prisma.wikiCategory.create({
    data: { name: 'Manager', nameEn: 'Manager Guide', nameRo: 'Ghid Manager', slug: 'ghid-manager', icon: '👥', sortOrder: 3, description: 'Ghid pentru manageri' },
  })

  const catHR = await prisma.wikiCategory.create({
    data: { name: 'HR', nameEn: 'HR Guide', nameRo: 'Ghid HR', slug: 'ghid-hr', icon: '🏢', sortOrder: 4, description: 'Ghid pentru departamentul HR' },
  })

  const catReguli = await prisma.wikiCategory.create({
    data: { name: 'Reguli', nameEn: 'Rules & Policies', nameRo: 'Reguli și Politici', slug: 'reguli-politici', icon: '📋', sortOrder: 5, description: 'Regulamentul intern privind concediile' },
  })

  console.log('Creating tags...')

  const tagTutorial = await prisma.wikiTag.create({ data: { name: 'tutorial', nameEn: 'Tutorial', nameRo: 'Tutorial' } })
  const tagImportant = await prisma.wikiTag.create({ data: { name: 'important', nameEn: 'Important', nameRo: 'Important' } })
  const tagFAQ = await prisma.wikiTag.create({ data: { name: 'faq', nameEn: 'FAQ', nameRo: 'Întrebări frecvente' } })
  const tagNou = await prisma.wikiTag.create({ data: { name: 'nou', nameEn: 'New', nameRo: 'Nou' } })

  console.log('Creating wiki pages...')

  // ────────────────────────────────
  // PAGE 1: Ce este această aplicație?
  // ────────────────────────────────
  const page1Content = doc(
    heading('Ce este LMS?', 1),
    p('Sistem de Management Concedii (LMS) este aplicația internă a companiei TPF pentru gestionarea electronică a concediilor, cererilor de lucru de acasă și planificării vacanțelor.'),
    hr(),
    heading('De ce folosim această aplicație?', 2),
    p('Înainte de LMS, cererile de concediu se făceau pe hârtie sau prin e-mail, ceea ce ducea la întârzieri, pierderi de documente și confuzii. Acum totul este centralizat:'),
    bulletList([
      'Depui cereri de concediu direct din aplicație, fără hârtii',
      'Managerul tău primește notificare și aprobă cu un click',
      'HR-ul are vizibilitate completă asupra soldurilor și istoricului',
      'Poți vedea oricând câte zile de concediu mai ai disponibile',
      'Calendarul echipei te ajută să planifici vacanțele fără suprapuneri',
    ]),
    hr(),
    heading('Cine are acces?', 2),
    p('Toți angajații companiei au acces la aplicație. Te autentifici cu contul tău Microsoft (e-mailul de serviciu). Nu ai nevoie de parolă separată.'),
    heading('Roluri în aplicație', 3),
    bulletList([
      'Angajat — depui cereri, vezi soldul, consulți calendarul echipei',
      'Manager — aprobi cererile echipei tale, vizualizezi statusul echipei',
      'Director de departament — aprobi la nivel de departament',
      'HR — administrezi politicile, gestionezi angajații, vezi rapoartele',
      'Executiv — ai acces la statistici la nivel de companie',
    ]),
    hr(),
    heading('Primii pași', 2),
    orderedList([
      'Accesează aplicația și apasă "Autentificare cu Microsoft"',
      'Vei fi redirecționat către pagina de login Microsoft — folosește e-mailul de serviciu',
      'După autentificare, vei ajunge la dashboard-ul personal',
      'De acolo poți depune cereri, vedea soldul și consulta calendarul',
    ]),
    blockquote('Dacă întâmpini probleme la autentificare, contactează departamentul HR.'),
  )

  await createPage({
    slug: 'ce-este-lms',
    categoryId: catGeneral.id,
    authorId,
    isPinned: true,
    sortOrder: 1,
    title: 'Ce este această aplicație?',
    content: page1Content,
    tagIds: [tagImportant.id, tagNou.id],
  })

  // ────────────────────────────────
  // PAGE 2: Cum depun o cerere de concediu
  // ────────────────────────────────
  const page2Content = doc(
    heading('Cum depun o cerere de concediu', 1),
    p('Acest ghid te va ajuta să depui o cerere de concediu pas cu pas.'),
    hr(),
    heading('Pași', 2),
    orderedList([
      'Din dashboard-ul tău, apasă butonul "Cerere nouă de concediu" (butonul albastru cu +)',
      'Selectează tipul de concediu (Odihnă, Medical, Personal, etc.)',
      'Alege data de început și data de sfârșit',
      'Dacă este cazul, alege un înlocuitor din echipa ta',
      'Adaugă un motiv sau comentariu (opțional, dar recomandat)',
      'Apasă "Trimite cererea"',
    ]),
    hr(),
    heading('Tipuri de concediu disponibile', 2),
    bulletList([
      'Concediu de odihnă — zilele tale anuale de vacanță',
      'Concediu medical — necesită certificat medical (se încarcă în aplicație)',
      'Concediu personal — pentru evenimente personale importante',
      'Concediu de studii — pentru cursuri, examene, formare profesională',
      'Concediu fără plată — zile libere neplătite, cu aprobare specială',
      'Zile speciale — căsătorie, naștere copil, deces în familie (conform legislației)',
    ]),
    hr(),
    heading('Ce se întâmplă după ce trimiți cererea?', 2),
    orderedList([
      'Cererea ajunge la managerul tău direct',
      'Managerul primește o notificare pe e-mail',
      'Dacă aprobă, cererea trece la HR pentru verificare finală (dacă este necesar)',
      'Primești notificare pe e-mail când cererea este aprobată sau respinsă',
      'Poți verifica statusul oricând din dashboard',
    ]),
    heading('Statusuri posibile', 3),
    bulletList([
      'În așteptare — cererea a fost trimisă, așteaptă aprobare',
      'Aprobat — cererea a fost aprobată de toți aprobatorii',
      'Respins — cererea a fost respinsă (vei vedea motivul)',
      'Anulat — ai anulat cererea înainte de aprobare',
    ]),
    hr(),
    heading('Sfaturi utile', 2),
    bulletList([
      'Depune cererea cu cel puțin 3 zile lucrătoare înainte',
      'Verifică calendarul echipei înainte — evită suprapunerile',
      'Pentru concediu medical, încarcă certificatul cât mai curând',
      'Poți anula o cerere în așteptare dacă planurile se schimbă',
    ]),
  )

  await createPage({
    slug: 'cum-depun-cerere-concediu',
    categoryId: catAngajat.id,
    authorId,
    sortOrder: 1,
    title: 'Cum depun o cerere de concediu',
    content: page2Content,
    tagIds: [tagTutorial.id],
  })

  // ────────────────────────────────
  // PAGE 3: Cum solicit lucru de acasă (WFH)
  // ────────────────────────────────
  const page3Content = doc(
    heading('Cum solicit lucru de acasă (WFH)', 1),
    p('Dacă ai nevoie să lucrezi de acasă, poți face cererea direct din aplicație.'),
    hr(),
    heading('Pași', 2),
    orderedList([
      'Din dashboard, apasă "Cerere WFH" (Work From Home)',
      'Selectează data sau perioada dorită',
      'Alege motivul din lista disponibilă sau scrie unul personalizat',
      'Apasă "Trimite cererea"',
    ]),
    heading('Reguli de bază', 2),
    bulletList([
      'Cererea trebuie trimisă cu cel puțin o zi înainte',
      'Managerul tău trebuie să aprobe cererea',
      'Respectă programul normal de lucru și fii disponibil online',
      'Anumite funcții sau perioade pot avea restricții — verifică cu managerul',
    ]),
    hr(),
    heading('Întrebări frecvente', 2),
    pWithBold('', 'Pot lucra de acasă mai multe zile consecutiv?'),
    p('Da, poți selecta o perioadă. Fiecare zi va fi tratată individual în cerere.'),
    pWithBold('', 'Ce fac dacă managerul respinge cererea?'),
    p('Vei primi notificare cu motivul respingerii. Poți discuta direct cu managerul sau depune o cerere nouă pentru o altă dată.'),
  )

  await createPage({
    slug: 'cum-solicit-lucru-de-acasa',
    categoryId: catAngajat.id,
    authorId,
    sortOrder: 2,
    title: 'Cum solicit lucru de acasă (WFH)',
    content: page3Content,
    tagIds: [tagTutorial.id],
  })

  // ────────────────────────────────
  // PAGE 4: Cum verific soldul de concediu
  // ────────────────────────────────
  const page4Content = doc(
    heading('Cum verific soldul de concediu', 1),
    p('Poți vedea oricând câte zile de concediu mai ai disponibile.'),
    hr(),
    heading('Unde găsesc informația?', 2),
    p('Pe dashboard-ul tău personal, în partea de sus, vei vedea un rezumat al soldurilor tale:'),
    bulletList([
      'Zile totale — câte zile ai dreptul pe anul curent',
      'Zile folosite — câte zile ai consumat deja',
      'Zile rămase — câte zile mai poți lua',
      'Zile reportate — zilele neutilizate din anul trecut (dacă este cazul)',
    ]),
    heading('Ce înseamnă fiecare tip?', 2),
    p('Aplicația afișează soldul pentru fiecare tip de concediu separat. Cele mai importante sunt:'),
    bulletList([
      'Concediu de odihnă — soldul principal, cel pe care îl urmărești cel mai des',
      'Zile speciale — alocate automat pentru evenimente (căsătorie, naștere, etc.)',
    ]),
    hr(),
    heading('Întrebări frecvente', 2),
    pWithBold('', 'De ce nu se potrivesc zilele cu ce am calculat eu?'),
    p('Soldurile sunt calculate pro-rata dacă ai fost angajat în cursul anului. De exemplu, dacă ai fost angajat din iunie, primești jumătate din zilele anuale.'),
    pWithBold('', 'Zilele de anul trecut se pierd?'),
    p('Depinde de politica companiei. De regulă, un număr limitat de zile pot fi reportate în anul următor. Consultă secțiunea de reguli pentru detalii.'),
  )

  await createPage({
    slug: 'cum-verific-soldul-concediu',
    categoryId: catAngajat.id,
    authorId,
    sortOrder: 3,
    title: 'Cum verific soldul de concediu',
    content: page4Content,
    tagIds: [tagTutorial.id, tagFAQ.id],
  })

  // ────────────────────────────────
  // PAGE 5: Calendarul echipei și planificarea vacanțelor
  // ────────────────────────────────
  const page5Content = doc(
    heading('Calendarul echipei și planificarea vacanțelor', 1),
    p('Aplicația include un calendar al echipei care te ajută să planifici vacanțele fără suprapuneri.'),
    hr(),
    heading('Cum accesez calendarul?', 2),
    orderedList([
      'Din dashboard, apasă tab-ul "Calendar"',
      'Vei vedea o vizualizare lunară cu concediile aprobate ale colegilor',
      'Folosește săgețile pentru a naviga între luni',
    ]),
    heading('Planificarea vacanțelor', 2),
    p('În anumite perioade, HR-ul deschide o fereastră de planificare a vacanțelor. Când este activă:'),
    orderedList([
      'Mergi la meniul "Planificare" → "Planificarea concediilor"',
      'Selectează perioadele dorite pentru vacanță pe calendar',
      'Trimite planificarea — managerul o va vizualiza și va coordona cu echipa',
    ]),
    hr(),
    heading('Sfaturi', 2),
    bulletList([
      'Consultă calendarul echipei înainte de a-ți planifica vacanța',
      'Evită să fii plecat în același timp cu toți colegii din echipă',
      'Planifică vacanțele lungi din timp, mai ales în sezon (iulie-august)',
      'Comunică cu echipa — calendarul ajută, dar comunicarea directă e esențială',
    ]),
  )

  await createPage({
    slug: 'calendar-echipa-planificare',
    categoryId: catAngajat.id,
    authorId,
    sortOrder: 4,
    title: 'Calendarul echipei și planificarea vacanțelor',
    content: page5Content,
    tagIds: [tagTutorial.id],
  })

  // ────────────────────────────────
  // PAGE 6: Ghid Manager — Cum aprob cererile echipei
  // ────────────────────────────────
  const page6Content = doc(
    heading('Cum aprob cererile echipei', 1),
    p('Ca manager, ai responsabilitatea de a aproba sau respinge cererile de concediu ale echipei tale.'),
    hr(),
    heading('Cum primesc notificare?', 2),
    p('Când un angajat din echipa ta depune o cerere, primești:'),
    bulletList([
      'O notificare pe e-mail cu detaliile cererii',
      'O notificare în aplicație (clopoțelul din dreapta sus)',
      'Un badge cu numărul de cereri în așteptare pe dashboard-ul de manager',
    ]),
    heading('Cum aprob sau resping?', 2),
    orderedList([
      'Accesează dashboard-ul de manager (meniul principal)',
      'Vei vedea lista cererilor în așteptare',
      'Apasă pe o cerere pentru a vedea detaliile',
      'Apasă "Aprobă" sau "Respinge"',
      'Dacă respingi, adaugă un motiv — angajatul îl va vedea',
    ]),
    hr(),
    heading('Ce trebuie să verific înainte de aprobare?', 2),
    bulletList([
      'Angajatul are suficiente zile disponibile?',
      'Nu sunt prea mulți colegi plecați în aceeași perioadă?',
      'Există proiecte urgente care necesită prezența persoanei?',
      'Calendarul echipei — verifică suprapunerile',
    ]),
    heading('Delegarea aprobărilor', 2),
    p('Dacă pleci în concediu sau nu ești disponibil, poți delega dreptul de aprobare:'),
    orderedList([
      'Din dashboard-ul de manager, mergi la tab-ul "Delegare"',
      'Selectează persoana căreia îi deleghezi aprobările',
      'Setează perioada delegării',
      'Delegatul va primi notificări și va putea aproba în locul tău',
    ]),
    blockquote('Important: Delegarea nu transferă responsabilitatea — verifică deciziile la întoarcere.'),
  )

  await createPage({
    slug: 'ghid-manager-aprobare-cereri',
    categoryId: catManager.id,
    authorId,
    sortOrder: 1,
    title: 'Cum aprob cererile echipei',
    content: page6Content,
    tagIds: [tagTutorial.id],
    visibleToRoles: ['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'],
  })

  // ────────────────────────────────
  // PAGE 7: Ghid Manager — Monitorizarea echipei
  // ────────────────────────────────
  const page7Content = doc(
    heading('Monitorizarea echipei', 1),
    p('Ca manager, ai acces la informații despre statusul de prezență și concediu al echipei tale.'),
    hr(),
    heading('Dashboard-ul de manager', 2),
    p('Pe dashboard vei vedea:'),
    bulletList([
      'Cine este prezent azi și cine este în concediu',
      'Cereri în așteptare de aprobare',
      'Statistici despre concediile echipei (zile folosite, tendințe)',
      'Calendar vizual cu toate concediile echipei',
    ]),
    heading('Tab-ul "Echipa"', 2),
    p('Accesează tab-ul "Echipa" pentru a vedea:'),
    bulletList([
      'Lista completă a membrilor echipei',
      'Soldul de concediu al fiecărui angajat',
      'Istoricul cererilor',
    ]),
    heading('Rapoarte și analize', 2),
    p('Din tab-ul "Analize" poți vedea:'),
    bulletList([
      'Rata de utilizare a concediilor pe echipă',
      'Perioadele cu cele mai multe cereri',
      'Angajații care nu și-au luat concediu de mult (risc de burnout)',
    ]),
    blockquote('Sfat: Încurajează angajații să-și ia concediul de odihnă regulat. Este important atât legal, cât și pentru sănătatea lor.'),
  )

  await createPage({
    slug: 'ghid-manager-monitorizare-echipa',
    categoryId: catManager.id,
    authorId,
    sortOrder: 2,
    title: 'Monitorizarea echipei',
    content: page7Content,
    tagIds: [tagTutorial.id],
    visibleToRoles: ['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'],
  })

  // ────────────────────────────────
  // PAGE 8: Ghid HR — Administrarea angajaților
  // ────────────────────────────────
  const page8Content = doc(
    heading('Administrarea angajaților', 1),
    p('Departamentul HR are acces la funcții avansate de administrare a angajaților și politicilor de concediu.'),
    hr(),
    heading('Gestionarea angajaților', 2),
    orderedList([
      'Accesează dashboard-ul HR',
      'În tab-ul "Angajați" vezi lista completă',
      'Poți căuta, filtra și edita informațiile angajaților',
      'De aici setezi roluri, departamente și solduri de concediu',
    ]),
    heading('Solduri și alocări', 2),
    p('Soldurile de concediu sunt calculate automat pe baza:'),
    bulletList([
      'Tipul de concediu și zilele alocate pe an',
      'Data angajării (calcul pro-rata pentru angajații noi)',
      'Zilele reportate din anul anterior',
      'Ajustări manuale (dacă este cazul)',
    ]),
    heading('Verificarea cererilor', 2),
    p('Anumite cereri necesită verificare HR (de exemplu, concediu medical cu certificat):'),
    orderedList([
      'Cererea apare în tab-ul "Verificare" după aprobarea managerului',
      'Verifică documentele atașate',
      'Aprobă sau respinge cu motivație',
    ]),
    hr(),
    heading('Tipuri de concediu', 2),
    p('Din tab-ul "Tipuri concediu" poți:'),
    bulletList([
      'Adăuga tipuri noi de concediu',
      'Modifica zilele alocate',
      'Activa sau dezactiva tipuri de concediu',
      'Seta dacă un tip necesită verificare HR',
    ]),
    heading('Rapoarte', 2),
    p('Tab-ul "Analize" oferă rapoarte detaliate:'),
    bulletList([
      'Export CSV cu toate datele',
      'Statistici pe departament, tip de concediu, perioadă',
      'Vizualizare calendar la nivel de companie',
    ]),
  )

  await createPage({
    slug: 'ghid-hr-administrare',
    categoryId: catHR.id,
    authorId,
    sortOrder: 1,
    title: 'Administrarea angajaților',
    content: page8Content,
    tagIds: [tagTutorial.id],
    visibleToRoles: ['HR', 'ADMIN'],
  })

  // ────────────────────────────────
  // PAGE 9: Regulile de concediu
  // ────────────────────────────────
  const page9Content = doc(
    heading('Regulile de concediu', 1),
    p('Acest document descrie politica companiei privind concediile și absențele.'),
    hr(),
    heading('Concediul de odihnă', 2),
    bulletList([
      'Fiecare angajat are dreptul la minimum 20 de zile lucrătoare de concediu de odihnă pe an (conform legislației)',
      'Numărul exact de zile depinde de vechime și funcție',
      'Concediul trebuie solicitat cu minimum 3 zile lucrătoare înainte',
      'Concediul de peste 10 zile consecutive trebuie solicitat cu 2 săptămâni înainte',
      'Managerul poate solicita reprogramarea dacă există suprapuneri critice în echipă',
    ]),
    heading('Reportarea zilelor', 2),
    bulletList([
      'Maximum 5 zile pot fi reportate în anul următor',
      'Zilele reportate trebuie folosite până la 30 iunie al anului următor',
      'Zilele nefolosite după această dată se pierd automat',
    ]),
    hr(),
    heading('Concediu medical', 2),
    bulletList([
      'Se depune cererea în aplicație cu certificat medical atașat',
      'Certificatul trebuie încărcat în maxim 3 zile de la emitere',
      'HR-ul verifică și validează certificatul',
      'Nu necesită aprobare manager (dar managerul este notificat)',
    ]),
    heading('Concediu fără plată', 2),
    bulletList([
      'Necesită aprobare manager + HR',
      'Se acordă doar în cazuri excepționale',
      'Maximum 30 de zile pe an',
      'Cererea trebuie trimisă cu minimum 5 zile lucrătoare înainte',
    ]),
    hr(),
    heading('Zile speciale (evenimente)', 2),
    p('Conform legislației, beneficiezi de zile libere plătite pentru:'),
    bulletList([
      'Căsătorie — 5 zile lucrătoare',
      'Nașterea unui copil — 5 zile lucrătoare (+ 10 zile dacă urmează curs de puericultură)',
      'Deces rudă grad I — 3 zile lucrătoare',
      'Deces rudă grad II — 1 zi lucrătoare',
      'Donare de sânge — 1 zi lucrătoare',
    ]),
    blockquote('Notă: Aceste zile se adaugă automat la soldul tău când depui cererea cu tipul corespunzător. Nu le consumi din concediul de odihnă.'),
    hr(),
    heading('Lucrul de acasă (WFH)', 2),
    bulletList([
      'Necesită cerere aprobată de manager',
      'Se solicită cu minimum o zi înainte',
      'Respectă programul de lucru normal',
      'Fii disponibil pe Teams/e-mail în timpul programului',
      'Unele funcții pot avea restricții privind WFH — verifică cu HR',
    ]),
  )

  await createPage({
    slug: 'regulile-de-concediu',
    categoryId: catReguli.id,
    authorId,
    isPinned: true,
    sortOrder: 1,
    title: 'Regulile de concediu',
    content: page9Content,
    tagIds: [tagImportant.id],
  })

  // ────────────────────────────────
  // PAGE 10: Întrebări frecvente (FAQ)
  // ────────────────────────────────
  const page10Content = doc(
    heading('Întrebări frecvente (FAQ)', 1),
    p('Răspunsuri la cele mai frecvente întrebări despre aplicație.'),
    hr(),
    heading('Nu mă pot autentifica. Ce fac?', 2),
    p('Asigură-te că folosești e-mailul de serviciu (@tpfing.ro). Dacă tot nu funcționează, contactează HR — posibil ca contul tău să nu fie încă adăugat în sistem.'),
    heading('Am trimis o cerere greșită. O pot anula?', 2),
    p('Da, atâta timp cât cererea este încă "în așteptare". Intră pe cerere și apasă butonul de anulare. Dacă a fost deja aprobată, contactează managerul sau HR.'),
    heading('Nu văd butonul de "Cerere nouă". De ce?', 2),
    p('Verifică dacă ești pe dashboard-ul corect. Butonul apare pe pagina principală a angajatului. Dacă tot nu îl vezi, verifică dacă ai soldul necesar pentru tipul de concediu dorit.'),
    heading('Câte zile de concediu am?', 2),
    p('Verifică pe dashboard-ul personal, secțiunea de solduri. Dacă cifrele nu par corecte, contactează HR pentru clarificare.'),
    heading('Pot modifica o cerere după ce am trimis-o?', 2),
    p('Nu poți modifica o cerere trimisă. Anuleaz-o și depune una nouă cu datele corecte.'),
    heading('Managerul meu nu răspunde la cerere. Ce fac?', 2),
    p('Aplicația are un sistem de escaladare automată. Dacă managerul nu răspunde în 48 de ore, cererea este escaladată. Poți, de asemenea, să-i trimiți un mesaj direct.'),
    heading('Cum încarc certificatul medical?', 2),
    p('Când depui cererea de concediu medical, ai opțiunea de a atașa un fișier. Acceptă formate PDF, JPG sau PNG. Dimensiunea maximă este de 20 MB.'),
    heading('Pot vedea cererile colegilor mei?', 2),
    p('Poți vedea concediile aprobate ale colegilor pe calendarul echipei. Nu ai acces la detaliile cererilor lor (motiv, tip exact, etc.), doar la perioadele de absență.'),
    hr(),
    heading('Alte întrebări?', 2),
    p('Dacă ai o întrebare care nu se regăsește aici, contactează departamentul HR sau lasă un comentariu pe această pagină.'),
  )

  await createPage({
    slug: 'intrebari-frecvente',
    categoryId: catGeneral.id,
    authorId,
    isPinned: true,
    sortOrder: 2,
    title: 'Întrebări frecvente (FAQ)',
    content: page10Content,
    tagIds: [tagFAQ.id, tagImportant.id],
  })

  // ────────────────────────────────
  // PAGE 11: Ghid HR — Rollover și închidere de an
  // ────────────────────────────────
  const page11Content = doc(
    heading('Rollover și închidere de an', 1),
    p('La sfârșitul fiecărui an, HR-ul trebuie să proceseze reportarea zilelor neutilizate.'),
    hr(),
    heading('Cum funcționează', 2),
    orderedList([
      'Accesează dashboard-ul HR → "Leave Rollover"',
      'Sistemul calculează automat zilele neutilizate pentru fiecare angajat',
      'Verifică lista — poți ajusta manual dacă este necesar',
      'Apasă "Procesează rollover" pentru a transfera zilele în anul nou',
    ]),
    heading('Reguli de rollover', 2),
    bulletList([
      'Maximum 5 zile pot fi reportate (configurabil din setări)',
      'Zilele reportate expiră la 30 iunie anul următor',
      'Angajații sunt notificați automat despre zilele reportate',
    ]),
    heading('Setări', 2),
    p('Din HR → Setări poți configura:'),
    bulletList([
      'Numărul maxim de zile reportabile',
      'Data limită de utilizare a zilelor reportate',
      'Dacă se aplică rollover automat sau manual',
    ]),
    blockquote('Recomandare: Procesează rollover-ul în prima săptămână a anului nou, după ce toate cererile din decembrie sunt finalizate.'),
  )

  await createPage({
    slug: 'ghid-hr-rollover',
    categoryId: catHR.id,
    authorId,
    sortOrder: 2,
    title: 'Rollover și închidere de an',
    content: page11Content,
    tagIds: [tagTutorial.id],
    visibleToRoles: ['HR', 'ADMIN'],
  })

  console.log('✅ Wiki seeded with 11 pages, 5 categories, 4 tags')
}

async function createPage(data: {
  slug: string
  categoryId: string
  authorId: string
  isPinned?: boolean
  sortOrder?: number
  title: string
  content: any
  tagIds?: string[]
  visibleToRoles?: Role[]
}) {
  const contentText = extractPlainText(data.content)
  const excerpt = contentText.slice(0, 200)

  const page = await prisma.wikiPage.create({
    data: {
      slug: data.slug,
      categoryId: data.categoryId,
      authorId: data.authorId,
      status: 'PUBLISHED',
      isPinned: data.isPinned || false,
      sortOrder: data.sortOrder || 0,
      visibleToRoles: data.visibleToRoles || [],
      publishedAt: new Date(),
      translations: {
        create: {
          language: 'ro',
          title: data.title,
          content: data.content,
          contentText,
          excerpt,
        },
      },
      revisions: {
        create: {
          language: 'ro',
          version: 1,
          title: data.title,
          content: data.content,
          authorId: data.authorId,
          changeNote: 'Versiunea inițială',
        },
      },
      tags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId })) }
        : undefined,
    },
  })

  console.log(`  ✓ ${data.title} (/${data.slug})`)
  return page
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
