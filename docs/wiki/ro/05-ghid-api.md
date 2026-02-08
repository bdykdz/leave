# Ghid API

Acest document descrie API-ul sistemului de gestionare a concediilor. Toate endpoint-urile sunt RESTful și returnează date în format JSON.

## Cuprins

- [Introducere](#introducere)
- [Autentificare](#autentificare)
- [URL de bază](#url-de-bază)
- [Coduri de răspuns](#coduri-de-răspuns)
- [Endpoint-uri disponibile](#endpoint-uri-disponibile)
  - [Sold concediu](#sold-concediu)
  - [Cereri de concediu](#cereri-de-concediu)
  - [Cereri WFH (Work From Home)](#cereri-wfh-work-from-home)
  - [Notificări](#notificări)
  - [Aprobări pentru manageri](#aprobări-pentru-manageri)
  - [Calendar](#calendar)
- [Exemple practice](#exemple-practice)
- [Limitarea ratei (Rate Limiting)](#limitarea-ratei-rate-limiting)
- [Gestionarea erorilor](#gestionarea-erorilor)

---

## Introducere

API-ul Leave Management permite integrarea programatică cu sistemul de gestionare a concediilor. Puteți folosi acest API pentru:

- **Verificarea soldului de zile** - aflați câte zile de concediu mai aveți disponibile
- **Trimiterea cererilor de concediu** - creați cereri noi de concediu sau WFH
- **Vizualizarea cererilor** - obțineți lista cererilor și statusul acestora
- **Gestionarea notificărilor** - citiți și marcați notificările ca citite
- **Aprobări** - managerii pot aproba sau respinge cererile echipei

API-ul folosește autentificare prin sesiuni NextAuth și comunică exclusiv prin HTTPS.

---

## Autentificare

### Cum funcționează autentificarea

Sistemul folosește **NextAuth.js** cu provider Azure AD pentru autentificare. Autentificarea se bazează pe sesiuni JWT (JSON Web Tokens).

### Obținerea sesiunii

Pentru a vă autentifica, trebuie să:

1. Accesați pagina de login (`/login`)
2. Vă autentificați cu Microsoft (Azure AD)
3. Sistemul vă va crea automat o sesiune

### Folosirea sesiunii în apeluri API

După autentificare, cookie-ul de sesiune (`next-auth.session-token`) este trimis automat cu fiecare cerere din browser.

**Pentru apeluri din cod (JavaScript/TypeScript):**

```javascript
// Apelurile din aceeași origine includ automat cookie-urile
const response = await fetch('/api/employee/leave-balance', {
  method: 'GET',
  credentials: 'include', // Include cookie-urile de sesiune
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Exemplu cURL (necesită cookie de sesiune):**

```bash
# Obține cookie-ul de sesiune după autentificare în browser
# și folosește-l în cereri

curl -X GET "https://your-domain.com/api/employee/leave-balance" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### Verificarea sesiunii curente

```javascript
// Verifică dacă utilizatorul este autentificat
const response = await fetch('/api/auth/session', {
  credentials: 'include'
});

const session = await response.json();

if (session?.user) {
  console.log('Utilizator autentificat:', session.user.email);
  console.log('Rol:', session.user.role);
} else {
  console.log('Nu există sesiune activă');
}
```

---

## URL de bază

Toate endpoint-urile API sunt relative la URL-ul de bază al aplicației:

```
https://your-domain.com/api
```

**În dezvoltare locală:**

```
http://localhost:3000/api
```

---

## Coduri de răspuns

API-ul folosește coduri HTTP standard:

| Cod | Descriere | Când apare |
|-----|-----------|------------|
| `200` | OK | Cererea a reușit |
| `201` | Created | Resursa a fost creată cu succes |
| `400` | Bad Request | Date invalide sau validare eșuată |
| `401` | Unauthorized | Nu sunteți autentificat |
| `403` | Forbidden | Nu aveți permisiuni pentru această acțiune |
| `404` | Not Found | Resursa nu a fost găsită |
| `500` | Internal Server Error | Eroare internă de server |

### Format răspuns de succes

```json
{
  "success": true,
  "data": { ... }
}
```

### Format răspuns de eroare

```json
{
  "error": "Descrierea erorii",
  "message": "Mesaj detaliat pentru utilizator",
  "details": [
    {
      "field": "startDate",
      "message": "Data de început este obligatorie"
    }
  ]
}
```

---

## Endpoint-uri disponibile

### Sold concediu

#### GET /api/employee/leave-balance

Returnează soldul de zile de concediu pentru utilizatorul curent.

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/employee/leave-balance" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const response = await fetch('/api/employee/leave-balance', {
  credentials: 'include'
});

const data = await response.json();
console.log(data.leaveBalances);
```

**Python:**

```python
import requests

session = requests.Session()
# Presupunem că sunteți autentificat și aveți cookie-ul de sesiune

response = session.get(
    'https://your-domain.com/api/employee/leave-balance',
    cookies={'next-auth.session-token': 'YOUR_SESSION_TOKEN'}
)

data = response.json()
print(data['leaveBalances'])
```

**Răspuns (200 OK):**

```json
{
  "leaveBalances": [
    {
      "leaveTypeId": "clh1234567",
      "leaveTypeName": "Concediu de odihnă",
      "leaveTypeCode": "AL",
      "description": "Concediu anual plătit",
      "year": 2026,
      "entitled": 21,
      "used": 5,
      "pending": 2,
      "available": 14,
      "hasBalance": true
    },
    {
      "leaveTypeId": "clh7654321",
      "leaveTypeName": "Concediu medical",
      "leaveTypeCode": "SL",
      "description": "Concediu pentru probleme de sănătate",
      "year": 2026,
      "used": 3,
      "hasBalance": false
    }
  ]
}
```

**Câmpuri importante:**

| Câmp | Tip | Descriere |
|------|-----|-----------|
| `entitled` | number | Numărul total de zile la care aveți dreptul |
| `used` | number | Zile deja folosite |
| `pending` | number | Zile în cereri în așteptare |
| `available` | number | Zile disponibile pentru cereri noi |
| `hasBalance` | boolean | Dacă tipul de concediu are sold limitat |

---

### Cereri de concediu

#### GET /api/leave-requests

Returnează lista cererilor de concediu ale utilizatorului.

**Parametri query:**

| Parametru | Tip | Descriere |
|-----------|-----|-----------|
| `status` | string | Filtrează după status: `PENDING`, `APPROVED`, `DENIED`, `CANCELLED`, `ALL` |
| `year` | string | Anul pentru filtrare (ex: `2026`) sau `all` pentru toate |

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/leave-requests?status=PENDING&year=2026" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const response = await fetch('/api/leave-requests?status=PENDING&year=2026', {
  credentials: 'include'
});

const data = await response.json();
console.log('Cereri în așteptare:', data.leaveRequests);
```

**Python:**

```python
import requests

response = session.get(
    'https://your-domain.com/api/leave-requests',
    params={'status': 'PENDING', 'year': '2026'},
    cookies={'next-auth.session-token': 'YOUR_SESSION_TOKEN'}
)

data = response.json()
for request in data['leaveRequests']:
    print(f"{request['requestNumber']}: {request['status']}")
```

**Răspuns (200 OK):**

```json
{
  "leaveRequests": [
    {
      "id": "clr1234567",
      "requestNumber": "LR-2026-0001",
      "userId": "user123",
      "leaveTypeId": "lt123",
      "startDate": "2026-03-15T00:00:00.000Z",
      "endDate": "2026-03-20T00:00:00.000Z",
      "totalDays": 4,
      "reason": "Vacanță de primăvară",
      "status": "PENDING",
      "selectedDates": [],
      "createdAt": "2026-02-01T10:30:00.000Z",
      "leaveType": {
        "id": "lt123",
        "name": "Concediu de odihnă",
        "code": "AL"
      },
      "substitute": {
        "id": "sub123",
        "firstName": "Maria",
        "lastName": "Ionescu",
        "email": "maria.ionescu@company.com"
      },
      "approvals": [
        {
          "id": "apr123",
          "level": 1,
          "status": "PENDING",
          "approver": {
            "id": "mgr123",
            "firstName": "Ion",
            "lastName": "Popescu",
            "role": "MANAGER"
          }
        }
      ]
    }
  ]
}
```

---

#### POST /api/leave-requests

Creează o nouă cerere de concediu.

**Body cerere (JSON):**

```json
{
  "leaveTypeId": "clh1234567",
  "startDate": "2026-03-15",
  "endDate": "2026-03-20",
  "reason": "Vacanță de primăvară cu familia",
  "substituteIds": ["user456"],
  "selectedDates": ["2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18"],
  "signature": "data:image/png;base64,..."
}
```

**Câmpuri:**

| Câmp | Obligatoriu | Descriere |
|------|-------------|-----------|
| `leaveTypeId` | Da | ID-ul tipului de concediu |
| `startDate` | Da | Data de început (format: `YYYY-MM-DD`) |
| `endDate` | Da | Data de sfârșit (format: `YYYY-MM-DD`) |
| `reason` | Da | Motivul cererii |
| `substituteIds` | Nu | Array cu ID-urile înlocuitorilor |
| `selectedDates` | Nu | Pentru concedii neconsecutive - array cu datele specifice |
| `signature` | Nu | Semnătura electronică în format base64 |

**cURL:**

```bash
curl -X POST "https://your-domain.com/api/leave-requests" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "leaveTypeId": "clh1234567",
    "startDate": "2026-03-15",
    "endDate": "2026-03-20",
    "reason": "Vacanță de primăvară",
    "substituteIds": ["user456"]
  }'
```

**JavaScript:**

```javascript
const response = await fetch('/api/leave-requests', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leaveTypeId: 'clh1234567',
    startDate: '2026-03-15',
    endDate: '2026-03-20',
    reason: 'Vacanță de primăvară',
    substituteIds: ['user456']
  })
});

const data = await response.json();

if (data.success) {
  console.log('Cerere creată:', data.leaveRequest.requestNumber);
} else {
  console.error('Eroare:', data.error);
}
```

**Python:**

```python
import requests
import json

payload = {
    'leaveTypeId': 'clh1234567',
    'startDate': '2026-03-15',
    'endDate': '2026-03-20',
    'reason': 'Vacanță de primăvară',
    'substituteIds': ['user456']
}

response = session.post(
    'https://your-domain.com/api/leave-requests',
    json=payload,
    cookies={'next-auth.session-token': 'YOUR_SESSION_TOKEN'}
)

data = response.json()

if data.get('success'):
    print(f"Cerere creată: {data['leaveRequest']['requestNumber']}")
else:
    print(f"Eroare: {data.get('error')}")
```

**Răspuns succes (200 OK):**

```json
{
  "success": true,
  "leaveRequest": {
    "id": "clr1234567",
    "requestNumber": "LR-2026-0001",
    "status": "PENDING",
    "totalDays": 4,
    "startDate": "2026-03-15T00:00:00.000Z",
    "endDate": "2026-03-20T00:00:00.000Z"
  }
}
```

**Răspuns eroare validare (400 Bad Request):**

```json
{
  "error": "Validation failed",
  "errors": [
    {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Nu aveți suficiente zile disponibile. Disponibil: 14, solicitat: 20"
    }
  ]
}
```

**Răspuns eroare suprapunere (400 Bad Request):**

```json
{
  "error": "Date conflict",
  "message": "Aveți deja o cerere de concediu din 10/03/2026 până în 12/03/2026. Alegeți alte date sau anulați cererea existentă."
}
```

---

### Cereri WFH (Work From Home)

#### GET /api/wfh-requests

Returnează lista cererilor de muncă de acasă.

**Parametri query:**

| Parametru | Tip | Descriere |
|-----------|-----|-----------|
| `status` | string | Filtrează după status: `PENDING`, `APPROVED`, `DENIED`, `CANCELLED`, `ALL` |
| `year` | string | Anul pentru filtrare sau `all` |

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/wfh-requests?status=ALL&year=2026" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const response = await fetch('/api/wfh-requests?year=2026', {
  credentials: 'include'
});

const data = await response.json();
console.log('Cereri WFH:', data.wfhRequests);
```

**Răspuns (200 OK):**

```json
{
  "wfhRequests": [
    {
      "id": "wfh123",
      "requestNumber": "WFH-2026-0001",
      "startDate": "2026-02-15T00:00:00.000Z",
      "endDate": "2026-02-15T00:00:00.000Z",
      "totalDays": 1,
      "location": "Acasă - București",
      "status": "APPROVED",
      "selectedDates": null,
      "createdAt": "2026-02-10T08:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/wfh-requests

Creează o nouă cerere de muncă de acasă.

**Body cerere (JSON):**

```json
{
  "startDate": "2026-02-20",
  "endDate": "2026-02-20",
  "location": "Acasă - București, str. Exemplu nr. 10",
  "selectedDates": ["2026-02-20"],
  "signature": "data:image/png;base64,..."
}
```

**cURL:**

```bash
curl -X POST "https://your-domain.com/api/wfh-requests" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "startDate": "2026-02-20",
    "endDate": "2026-02-20",
    "location": "Acasă - București"
  }'
```

**JavaScript:**

```javascript
const response = await fetch('/api/wfh-requests', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    startDate: '2026-02-20',
    endDate: '2026-02-20',
    location: 'Acasă - București'
  })
});

const data = await response.json();

if (data.success) {
  console.log('Cerere WFH creată:', data.wfhRequest.requestNumber);
}
```

**Python:**

```python
payload = {
    'startDate': '2026-02-20',
    'endDate': '2026-02-20',
    'location': 'Acasă - București'
}

response = session.post(
    'https://your-domain.com/api/wfh-requests',
    json=payload,
    cookies={'next-auth.session-token': 'YOUR_SESSION_TOKEN'}
)

data = response.json()
if data.get('success'):
    print(f"Cerere WFH creată: {data['wfhRequest']['requestNumber']}")
```

---

### Notificări

#### GET /api/notifications

Returnează notificările utilizatorului.

**Parametri query:**

| Parametru | Tip | Descriere |
|-----------|-----|-----------|
| `limit` | number | Numărul maxim de notificări (implicit: 50) |
| `unreadOnly` | boolean | Doar notificările necitite (`true`/`false`) |

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/notifications?limit=20&unreadOnly=true" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const response = await fetch('/api/notifications?unreadOnly=true', {
  credentials: 'include'
});

const data = await response.json();
console.log('Notificări necitite:', data.unreadCount);
console.log('Notificări:', data.notifications);
```

**Răspuns (200 OK):**

```json
{
  "notifications": [
    {
      "id": "notif123",
      "userId": "user123",
      "type": "APPROVAL_REQUIRED",
      "title": "Cerere de concediu aprobată",
      "message": "Cererea dvs. de concediu pentru 15-20 Martie a fost aprobată",
      "link": "/employee/leave-requests/clr123",
      "isRead": false,
      "createdAt": "2026-02-01T14:30:00.000Z"
    }
  ],
  "unreadCount": 3,
  "total": 15
}
```

---

#### POST /api/notifications/{notificationId}/read

Marchează o notificare ca citită.

**Cerere:**

```bash
curl -X POST "https://your-domain.com/api/notifications/notif123/read" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
await fetch('/api/notifications/notif123/read', {
  method: 'POST',
  credentials: 'include'
});
```

---

#### POST /api/notifications/mark-all-read

Marchează toate notificările ca citite.

**JavaScript:**

```javascript
await fetch('/api/notifications/mark-all-read', {
  method: 'POST',
  credentials: 'include'
});
```

---

### Aprobări pentru manageri

Aceste endpoint-uri sunt disponibile doar pentru utilizatorii cu rol de **MANAGER**, **DEPARTMENT_DIRECTOR**, **EXECUTIVE** sau **HR**.

#### GET /api/manager/team/pending-approvals

Returnează cererile în așteptare pentru aprobare.

**Parametri query:**

| Parametru | Tip | Descriere |
|-----------|-----|-----------|
| `page` | number | Numărul paginii (implicit: 1) |
| `limit` | number | Numărul de rezultate pe pagină (implicit: 10) |

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/manager/team/pending-approvals?page=1&limit=10" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const response = await fetch('/api/manager/team/pending-approvals?page=1&limit=10', {
  credentials: 'include'
});

const data = await response.json();
console.log('Cereri de aprobat:', data.requests);
console.log('Total:', data.pagination.total);
```

**Răspuns (200 OK):**

```json
{
  "requests": [
    {
      "id": "clr123",
      "requestType": "leave",
      "employee": {
        "name": "Ana Popescu",
        "avatar": "",
        "department": "IT"
      },
      "type": "Concediu de odihnă",
      "dates": "15/03/2026 - 20/03/2026",
      "startDate": "2026-03-15T00:00:00.000Z",
      "endDate": "2026-03-20T00:00:00.000Z",
      "days": 4,
      "reason": "Vacanță de primăvară",
      "submittedDate": "2026-02-01T10:00:00.000Z",
      "substitute": "Maria Ionescu",
      "status": "pending"
    },
    {
      "id": "wfh456",
      "requestType": "wfh",
      "employee": {
        "name": "Ion Gheorghe",
        "department": "Marketing"
      },
      "type": "Work From Home",
      "dates": "22/02/2026 - 22/02/2026",
      "days": 1,
      "reason": "Acasă - București",
      "location": "Acasă - București",
      "status": "pending"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### POST /api/manager/team/approve-request/{requestId}

Aprobă o cerere de concediu.

**Cerere:**

```bash
curl -X POST "https://your-domain.com/api/manager/team/approve-request/clr123" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"signature": "data:image/png;base64,..."}'
```

**JavaScript:**

```javascript
const response = await fetch('/api/manager/team/approve-request/clr123', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    signature: 'data:image/png;base64,...' // Opțional
  })
});

const data = await response.json();
if (data.success) {
  console.log('Cerere aprobată!');
}
```

---

#### POST /api/manager/team/deny-request/{requestId}

Respinge o cerere de concediu.

**Body cerere:**

```json
{
  "reason": "Motivul respingerii cererii"
}
```

**JavaScript:**

```javascript
const response = await fetch('/api/manager/team/deny-request/clr123', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Perioadă de vârf - nu putem permite absențe'
  })
});
```

---

### Calendar

#### GET /api/calendar

Returnează evenimentele de calendar (concedii și WFH) pentru o perioadă.

**Parametri query:**

| Parametru | Tip | Descriere |
|-----------|-----|-----------|
| `start` | string | Data de început (format ISO) |
| `end` | string | Data de sfârșit (format ISO) |
| `teamOnly` | boolean | Doar membrii echipei (`true`/`false`) |

**Cerere:**

```bash
curl -X GET "https://your-domain.com/api/calendar?start=2026-02-01&end=2026-02-28" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**JavaScript:**

```javascript
const start = '2026-02-01';
const end = '2026-02-28';

const response = await fetch(`/api/calendar?start=${start}&end=${end}`, {
  credentials: 'include'
});

const events = await response.json();
console.log('Evenimente calendar:', events);
```

---

## Exemple practice

### Exemplu 1: Verifică soldul și trimite o cerere de concediu

```javascript
async function createLeaveRequest() {
  // Pasul 1: Verifică soldul disponibil
  const balanceResponse = await fetch('/api/employee/leave-balance', {
    credentials: 'include'
  });
  const balanceData = await balanceResponse.json();

  // Găsește concediul de odihnă
  const annualLeave = balanceData.leaveBalances.find(
    b => b.leaveTypeCode === 'AL'
  );

  console.log(`Zile disponibile: ${annualLeave.available}`);

  if (annualLeave.available < 5) {
    console.log('Nu aveți suficiente zile pentru această cerere');
    return;
  }

  // Pasul 2: Trimite cererea
  const requestResponse = await fetch('/api/leave-requests', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      leaveTypeId: annualLeave.leaveTypeId,
      startDate: '2026-03-15',
      endDate: '2026-03-20',
      reason: 'Vacanță de primăvară cu familia'
    })
  });

  const requestData = await requestResponse.json();

  if (requestData.success) {
    console.log(`Cerere creată: ${requestData.leaveRequest.requestNumber}`);
    console.log(`Zile solicitate: ${requestData.leaveRequest.totalDays}`);
  } else {
    console.error('Eroare:', requestData.error);
  }
}
```

### Exemplu 2: Listează cererile în așteptare (Python)

```python
import requests

class LeaveManagementAPI:
    def __init__(self, base_url, session_token):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.cookies.set('next-auth.session-token', session_token)

    def get_leave_balance(self):
        """Obține soldul de zile de concediu."""
        response = self.session.get(f'{self.base_url}/api/employee/leave-balance')
        return response.json()

    def get_pending_requests(self):
        """Obține cererile în așteptare."""
        response = self.session.get(
            f'{self.base_url}/api/leave-requests',
            params={'status': 'PENDING'}
        )
        return response.json()

    def create_leave_request(self, leave_type_id, start_date, end_date, reason):
        """Creează o cerere nouă de concediu."""
        payload = {
            'leaveTypeId': leave_type_id,
            'startDate': start_date,
            'endDate': end_date,
            'reason': reason
        }
        response = self.session.post(
            f'{self.base_url}/api/leave-requests',
            json=payload
        )
        return response.json()

# Utilizare
api = LeaveManagementAPI(
    base_url='https://your-domain.com',
    session_token='your-session-token'
)

# Verifică soldul
balance = api.get_leave_balance()
for leave in balance['leaveBalances']:
    if leave.get('hasBalance'):
        print(f"{leave['leaveTypeName']}: {leave['available']} zile disponibile")

# Listează cererile pending
pending = api.get_pending_requests()
for request in pending['leaveRequests']:
    print(f"{request['requestNumber']}: {request['totalDays']} zile - {request['status']}")
```

### Exemplu 3: Dashboard pentru manageri (JavaScript)

```javascript
async function loadManagerDashboard() {
  try {
    // Încarcă toate datele în paralel
    const [pendingResponse, approvedResponse, teamResponse] = await Promise.all([
      fetch('/api/manager/team/pending-approvals', { credentials: 'include' }),
      fetch('/api/manager/team/approved-requests', { credentials: 'include' }),
      fetch('/api/manager/team-members', { credentials: 'include' })
    ]);

    const [pending, approved, team] = await Promise.all([
      pendingResponse.json(),
      approvedResponse.json(),
      teamResponse.json()
    ]);

    // Afișează statistici
    console.log('=== Dashboard Manager ===');
    console.log(`Cereri de aprobat: ${pending.pagination?.total || 0}`);
    console.log(`Cereri aprobate luna aceasta: ${approved.requests?.length || 0}`);
    console.log(`Membri echipă: ${team.members?.length || 0}`);

    // Listează cererile de aprobat
    if (pending.requests?.length > 0) {
      console.log('\n--- Cereri în așteptare ---');
      pending.requests.forEach(req => {
        console.log(`${req.employee.name}: ${req.type} (${req.days} zile) - ${req.dates}`);
      });
    }

  } catch (error) {
    console.error('Eroare la încărcarea dashboard-ului:', error);
  }
}
```

---

## Limitarea ratei (Rate Limiting)

În prezent, API-ul nu implementează limitare explicită a ratei la nivelul aplicației. Cu toate acestea:

- **Recomandări**: Evitați mai mult de 60 de cereri pe minut per utilizator
- **Apeluri în loturi**: Folosiți `Promise.all()` pentru cereri paralele în loc de loop-uri secvențiale
- **Caching**: Implementați cache local pentru date care nu se schimbă frecvent (ex: tipuri de concediu)

**Exemplu de bună practică:**

```javascript
// Bine - cereri paralele
const [balance, requests, notifications] = await Promise.all([
  fetch('/api/employee/leave-balance', { credentials: 'include' }),
  fetch('/api/leave-requests', { credentials: 'include' }),
  fetch('/api/notifications?limit=10', { credentials: 'include' })
]);

// Evitați - cereri secvențiale inutile
// for (const id of ids) {
//   await fetch(`/api/leave-requests/${id}`);
// }
```

---

## Gestionarea erorilor

### Erori comune și soluții

#### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

**Cauză**: Sesiunea a expirat sau nu sunteți autentificat.

**Soluție**: Re-autentificați-vă accesând `/login`.

---

#### 403 Forbidden

```json
{
  "error": "Access denied"
}
```

**Cauză**: Nu aveți permisiunile necesare pentru această acțiune.

**Soluție**: Verificați că rolul dvs. permite accesul la acest endpoint. Endpoint-urile de manager necesită rol de MANAGER sau superior.

---

#### 400 Bad Request - Validare

```json
{
  "error": "Validation failed",
  "errors": [
    {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Nu aveți suficiente zile disponibile"
    }
  ]
}
```

**Cauză**: Datele trimise nu sunt valide sau nu îndeplinesc condițiile de business.

**Soluție**: Verificați soldul disponibil și corectați datele din cerere.

---

#### 400 Bad Request - Conflict de date

```json
{
  "error": "Date conflict",
  "message": "Aveți deja o cerere pentru această perioadă"
}
```

**Cauză**: Există deja o cerere care se suprapune cu datele selectate.

**Soluție**: Alegeți alte date sau anulați cererea existentă.

---

### Gestionarea erorilor în cod

**JavaScript:**

```javascript
async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      // Gestionează erori HTTP
      switch (response.status) {
        case 401:
          // Redirecționează la login
          window.location.href = '/login';
          break;
        case 403:
          throw new Error('Nu aveți permisiunea să efectuați această acțiune');
        case 400:
          // Eroare de validare
          if (data.errors) {
            const messages = data.errors.map(e => e.message).join(', ');
            throw new Error(messages);
          }
          throw new Error(data.message || data.error);
        default:
          throw new Error(data.error || 'Eroare necunoscută');
      }
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Utilizare
try {
  const balance = await safeApiCall('/api/employee/leave-balance');
  console.log(balance);
} catch (error) {
  alert(error.message);
}
```

**Python:**

```python
import requests
from requests.exceptions import RequestException

class APIError(Exception):
    def __init__(self, status_code, message, errors=None):
        self.status_code = status_code
        self.message = message
        self.errors = errors or []
        super().__init__(self.message)

def safe_api_call(session, url, method='GET', **kwargs):
    try:
        response = session.request(method, url, **kwargs)
        data = response.json()

        if not response.ok:
            raise APIError(
                status_code=response.status_code,
                message=data.get('message') or data.get('error', 'Eroare necunoscută'),
                errors=data.get('errors', [])
            )

        return data

    except RequestException as e:
        raise APIError(0, f'Eroare de rețea: {str(e)}')

# Utilizare
try:
    balance = safe_api_call(session, f'{base_url}/api/employee/leave-balance')
    print(balance)
except APIError as e:
    print(f'Eroare {e.status_code}: {e.message}')
    for error in e.errors:
        print(f'  - {error.get("message")}')
```

---

## Suport și contact

Pentru întrebări sau probleme legate de API:

1. **Documentație internă**: Consultați wiki-ul companiei
2. **Suport tehnic**: Contactați echipa IT
3. **Probleme de acces**: Contactați departamentul HR pentru activarea contului

---

*Ultima actualizare: Februarie 2026*
