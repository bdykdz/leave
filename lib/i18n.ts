export type Language = 'en' | 'ro'

export interface Translations {
  // Common
  common: {
    back: string
    cancel: string
    submit: string
    save: string
    delete: string
    edit: string
    close: string
    yes: string
    no: string
    loading: string
    error: string
    success: string
    required: string
    optional: string
    search: string
    filter: string
    clear: string
    apply: string
    today: string
    yesterday: string
    tomorrow: string
    thisWeek: string
    lastWeek: string
    nextWeek: string
    thisMonth: string
    lastMonth: string
    nextMonth: string
  }

  // Navigation
  nav: {
    dashboard: string
    calendar: string
    requests: string
    team: string
    analytics: string
    profile: string
    settings: string
    logout: string
  }

  // Dashboard
  dashboard: {
    title: string
    welcomeBack: string
    quickActions: string
    newLeaveRequest: string
    newRemoteRequest: string
    pendingRequests: string
    teamCalendar: string
    leaveBalance: string
    upcomingHolidays: string
    teamOverview: string
    recentActivity: string
    myRequests: string
    allRequests: string
    teamStats: string
    pendingApprovals: string
    approvedRequests: string
    rejectedRequests: string
  }

  // Leave Request Form
  leaveForm: {
    title: string
    leaveType: string
    selectLeaveType: string
    startDate: string
    endDate: string
    reason: string
    reasonPlaceholder: string
    substituteRequired: string
    selectSubstitute: string
    noSubstituteNeeded: string
    documentRequired: string
    uploadDocument: string
    signature: string
    signHere: string
    clearSignature: string
    submitRequest: string
    requestSubmitted: string
    requestSubmittedSuccess: string
    balance: string
    entitled: string
    used: string
    pending: string
    available: string
    days: string
    maxDaysPerRequest: string
    selectDates: string
    duration: string
    totalDays: string
  }

  // Remote Work Form
  remoteForm: {
    title: string
    workLocation: string
    selectLocation: string
    reason: string
    reasonPlaceholder: string
    submitRequest: string
    requestSubmitted: string
    requestSubmittedSuccess: string
  }

  // Leave Types
  leaveTypes: {
    annual: string
    sick: string
    maternity: string
    paternity: string
    study: string
    unpaid: string
    compassionate: string
    special: string
  }

  // Status
  status: {
    pending: string
    approved: string
    rejected: string
    cancelled: string
    draft: string
    partiallyApproved: string
  }

  // Validation
  validation: {
    required: string
    invalidDate: string
    endDateAfterStart: string
    maxDaysExceeded: string
    weekendsNotAllowed: string
    holidayNotAllowed: string
    overlappingRequest: string
    insufficientBalance: string
    signatureRequired: string
    documentRequired: string
  }

  // Manager specific
  manager: {
    approveRequest: string
    rejectRequest: string
    viewDetails: string
    addComment: string
    commentPlaceholder: string
    approve: string
    reject: string
    requestApproved: string
    requestRejected: string
    teamMember: string
    approvalRequired: string
    approvalHistory: string
  }
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      back: "Back",
      cancel: "Cancel",
      submit: "Submit",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      yes: "Yes",
      no: "No",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      required: "Required",
      optional: "Optional",
      search: "Search",
      filter: "Filter",
      clear: "Clear",
      apply: "Apply",
      today: "Today",
      yesterday: "Yesterday",
      tomorrow: "Tomorrow",
      thisWeek: "This Week",
      lastWeek: "Last Week",
      nextWeek: "Next Week",
      thisMonth: "This Month",
      lastMonth: "Last Month",
      nextMonth: "Next Month"
    },
    nav: {
      dashboard: "Dashboard",
      calendar: "Calendar",
      requests: "Requests",
      team: "Team",
      analytics: "Analytics",
      profile: "Profile",
      settings: "Settings",
      logout: "Logout"
    },
    dashboard: {
      title: "Dashboard",
      welcomeBack: "Welcome back",
      quickActions: "Quick Actions",
      newLeaveRequest: "New Leave Request",
      newRemoteRequest: "New Remote Work Request",
      pendingRequests: "Pending Requests",
      teamCalendar: "Team Calendar",
      leaveBalance: "Leave Balance",
      upcomingHolidays: "Upcoming Holidays",
      teamOverview: "Team Overview",
      recentActivity: "Recent Activity",
      myRequests: "My Requests",
      allRequests: "All Requests",
      teamStats: "Team Statistics",
      pendingApprovals: "Pending Approvals",
      approvedRequests: "Approved Requests",
      rejectedRequests: "Rejected Requests"
    },
    leaveForm: {
      title: "New Leave Request",
      leaveType: "Leave Type",
      selectLeaveType: "Select leave type",
      startDate: "Start Date",
      endDate: "End Date",
      reason: "Reason",
      reasonPlaceholder: "Please provide a reason for your leave request...",
      substituteRequired: "Substitute Required",
      selectSubstitute: "Select substitute",
      noSubstituteNeeded: "No substitute needed",
      documentRequired: "Document Required",
      uploadDocument: "Upload Document",
      signature: "Signature",
      signHere: "Sign here",
      clearSignature: "Clear Signature",
      submitRequest: "Submit Request",
      requestSubmitted: "Request Submitted",
      requestSubmittedSuccess: "Your leave request has been submitted successfully and is pending approval.",
      balance: "Balance",
      entitled: "Entitled",
      used: "Used",
      pending: "Pending",
      available: "Available",
      days: "days",
      maxDaysPerRequest: "Max days per request",
      selectDates: "Select dates on the calendar",
      duration: "Duration",
      totalDays: "Total Days"
    },
    remoteForm: {
      title: "New Remote Work Request",
      workLocation: "Work Location",
      selectLocation: "Select work location",
      reason: "Reason",
      reasonPlaceholder: "Please provide a reason for working remotely...",
      submitRequest: "Submit Request",
      requestSubmitted: "Request Submitted",
      requestSubmittedSuccess: "Your remote work request has been submitted successfully and is pending approval."
    },
    leaveTypes: {
      annual: "Annual Leave",
      sick: "Sick Leave",
      maternity: "Maternity Leave",
      paternity: "Paternity Leave",
      study: "Study Leave",
      unpaid: "Unpaid Leave",
      compassionate: "Compassionate Leave",
      special: "Special Leave"
    },
    status: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
      draft: "Draft",
      partiallyApproved: "Partially Approved"
    },
    validation: {
      required: "This field is required",
      invalidDate: "Invalid date",
      endDateAfterStart: "End date must be after start date",
      maxDaysExceeded: "Maximum days per request exceeded",
      weekendsNotAllowed: "Weekends are not allowed",
      holidayNotAllowed: "Holidays are not allowed",
      overlappingRequest: "You have an overlapping request",
      insufficientBalance: "Insufficient leave balance",
      signatureRequired: "Signature is required",
      documentRequired: "Document is required"
    },
    manager: {
      approveRequest: "Approve Request",
      rejectRequest: "Reject Request",
      viewDetails: "View Details",
      addComment: "Add Comment",
      commentPlaceholder: "Add your comment here...",
      approve: "Approve",
      reject: "Reject",
      requestApproved: "Request Approved",
      requestRejected: "Request Rejected",
      teamMember: "Team Member",
      approvalRequired: "Approval Required",
      approvalHistory: "Approval History"
    }
  },
  ro: {
    common: {
      back: "Înapoi",
      cancel: "Anulează",
      submit: "Trimite",
      save: "Salvează",
      delete: "Șterge",
      edit: "Editează",
      close: "Închide",
      yes: "Da",
      no: "Nu",
      loading: "Se încarcă...",
      error: "Eroare",
      success: "Succes",
      required: "Obligatoriu",
      optional: "Opțional",
      search: "Caută",
      filter: "Filtrează",
      clear: "Șterge",
      apply: "Aplică",
      today: "Astăzi",
      yesterday: "Ieri",
      tomorrow: "Mâine",
      thisWeek: "Săptămâna aceasta",
      lastWeek: "Săptămâna trecută",
      nextWeek: "Săptămâna viitoare",
      thisMonth: "Luna aceasta",
      lastMonth: "Luna trecută",
      nextMonth: "Luna viitoare"
    },
    nav: {
      dashboard: "Tablou de bord",
      calendar: "Calendar",
      requests: "Cereri",
      team: "Echipă",
      analytics: "Analiză",
      profile: "Profil",
      settings: "Setări",
      logout: "Deconectare"
    },
    dashboard: {
      title: "Tablou de bord",
      welcomeBack: "Bun venit înapoi",
      quickActions: "Acțiuni rapide",
      newLeaveRequest: "Cerere nouă de concediu",
      newRemoteRequest: "Cerere nouă de lucru la distanță",
      pendingRequests: "Cereri în așteptare",
      teamCalendar: "Calendar echipă",
      leaveBalance: "Sold concediu",
      upcomingHolidays: "Sărbători următoare",
      teamOverview: "Prezentare echipă",
      recentActivity: "Activitate recentă",
      myRequests: "Cererile mele",
      allRequests: "Toate cererile",
      teamStats: "Statistici echipă",
      pendingApprovals: "Aprobări în așteptare",
      approvedRequests: "Cereri aprobate",
      rejectedRequests: "Cereri respinse"
    },
    leaveForm: {
      title: "Cerere nouă de concediu",
      leaveType: "Tip concediu",
      selectLeaveType: "Selectează tipul de concediu",
      startDate: "Data de început",
      endDate: "Data de sfârșit",
      reason: "Motivul",
      reasonPlaceholder: "Vă rugăm să oferiți un motiv pentru cererea de concediu...",
      substituteRequired: "Înlocuitor necesar",
      selectSubstitute: "Selectează înlocuitor",
      noSubstituteNeeded: "Nu este necesar înlocuitor",
      documentRequired: "Document necesar",
      uploadDocument: "Încarcă document",
      signature: "Semnătură",
      signHere: "Semnează aici",
      clearSignature: "Șterge semnătura",
      submitRequest: "Trimite cererea",
      requestSubmitted: "Cerere trimisă",
      requestSubmittedSuccess: "Cererea dvs. de concediu a fost trimisă cu succes și este în așteptarea aprobării.",
      balance: "Sold",
      entitled: "Îndreptățit",
      used: "Folosit",
      pending: "În așteptare",
      available: "Disponibil",
      days: "zile",
      maxDaysPerRequest: "Maxim zile per cerere",
      selectDates: "Selectează datele pe calendar",
      duration: "Durata",
      totalDays: "Total zile"
    },
    remoteForm: {
      title: "Cerere nouă de lucru la distanță",
      workLocation: "Locația de lucru",
      selectLocation: "Selectează locația de lucru",
      reason: "Motivul",
      reasonPlaceholder: "Vă rugăm să oferiți un motiv pentru lucrul la distanță...",
      submitRequest: "Trimite cererea",
      requestSubmitted: "Cerere trimisă",
      requestSubmittedSuccess: "Cererea dvs. de lucru la distanță a fost trimisă cu succes și este în așteptarea aprobării."
    },
    leaveTypes: {
      annual: "Concediu de odihnă",
      sick: "Concediu medical",
      maternity: "Concediu de maternitate",
      paternity: "Concediu de paternitate",
      study: "Concediu de studii",
      unpaid: "Concediu fără plată",
      compassionate: "Concediu din motive personale",
      special: "Concediu special"
    },
    status: {
      pending: "În așteptare",
      approved: "Aprobat",
      rejected: "Respins",
      cancelled: "Anulat",
      draft: "Ciornă",
      partiallyApproved: "Aprobat parțial"
    },
    validation: {
      required: "Acest câmp este obligatoriu",
      invalidDate: "Dată invalidă",
      endDateAfterStart: "Data de sfârșit trebuie să fie după data de început",
      maxDaysExceeded: "S-a depășit numărul maxim de zile per cerere",
      weekendsNotAllowed: "Weekend-urile nu sunt permise",
      holidayNotAllowed: "Sărbătorile nu sunt permise",
      overlappingRequest: "Aveți o cerere care se suprapune",
      insufficientBalance: "Sold insuficient de concediu",
      signatureRequired: "Semnătura este obligatorie",
      documentRequired: "Documentul este obligatoriu"
    },
    manager: {
      approveRequest: "Aprobă cererea",
      rejectRequest: "Respinge cererea",
      viewDetails: "Vezi detalii",
      addComment: "Adaugă comentariu",
      commentPlaceholder: "Adaugă comentariul tău aici...",
      approve: "Aprobă",
      reject: "Respinge",
      requestApproved: "Cerere aprobată",
      requestRejected: "Cerere respinsă",
      teamMember: "Membru echipă",
      approvalRequired: "Aprobare necesară",
      approvalHistory: "Istoric aprobări"
    }
  }
}

export function getTranslations(language: Language): Translations {
  return translations[language]
}