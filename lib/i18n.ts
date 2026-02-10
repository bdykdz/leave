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
    approve: string
    deny: string
    previous: string
    next: string
    page: string
    of: string
    showing: string
    noResults: string
    notAvailable: string
    unknown: string
    leave: string
    wfh: string
    workFromHome: string
    day: string
    days: string
    working: string
    signOut: string
    logOut: string
    viewAll: string
    viewDetails: string
    remove: string
    saveDraft: string
    saveChanges: string
    saving: string
    submitting: string
    export: string
    requestLeave: string
    generating: string
    profile: string
    requests: string
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
    leaveManagement: string
    adminDashboard: string
    hrDashboard: string
    managerDashboard: string
    executiveDashboard: string
    adminPanel: string
    planning: string
    myHolidayPlanning: string
    teamHolidayPlans: string
    departmentPlans: string
    companyCalendar: string
    delegation: string
    myDashboard: string
    backToDashboard: string
    backToPersonalDashboard: string
    escalatedApprovals: string
    navigation: string
    quickAccessToAllFeatures: string
    myLeave: string
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
    summary: {
      title: string
      noActivity: string
      onLeaveToday: string
      workingFromHome: string
      substitutingFor: string
      pendingRequests: string
      errors: {
        fetchFailed: string
        unknown: string
        loadFailed: string
      }
    }
    recentRequests: string
    recentRequestsDescription: string
    noRequestsFound: string
    loadingRequests: string
    companyHolidays: string
    personalLeaveAllocation: string
    myRecentRequests: string
    myRecentRequestsDescription: string
    noRecentRequests: string
    directReportApprovals: string
    directReportApprovalsDescription: string
    noPendingFromTeam: string
    escalatedRequestsTitle: string
    escalatedRequestsDescription: string
    noEscalatedRequests: string
    vacationDays: string
    medicalLeave: string
    personalDays: string
    remoteWorkUsage: string
    myRequestsDescription: string
    pendingTeamApprovals: string
    pendingTeamApprovalsDescription: string
    teamQuickStats: string
    reportingManager: string
    teamLeaveRequests: string
    teamLeaveRequestsDescription: string
    teamMembers: string
    inOffice: string
    workingFromHome: string
    onLeave: string
    teamRemoteWorkUsage: string
  }

  // Buttons
  buttons: {
    review: string
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
    active: string
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

  // Labels
  labels: {
    totalTeamSize: string
    presentToday: string
    remoteToday: string
    awayToday: string
    daysUsedThisYear: string
    managedByHR: string
    wfhThisMonth: string
    avgTeamWfhPercentage: string
    forLeaveApprovals: string
    noSuperior: string
    contactHrForSuperior: string
    workingDaysThisMonth: string
    pendingExecutive: string
    approvedByYou: string
    submitted: string
    approvedOn: string
    deniedOn: string
    totalDays: string
    essentialDays: string
    firstHoliday: string
    totalMembers: string
    plansSubmitted: string
    planningCoverage: string
    datesSelected: string
    noLimitTrackedByHr: string
    noSpecialLeaveTaken: string
    totalSpecialLeave: string
    requested: string
    awaitingApproval: string
    cancelling: string
    manageTeam: string
    noPendingRequests: string
    viewAllTeamRequests: string
    generateTeamReport: string
    denialReason: string
    noApprovedRequests: string
    noDeniedRequests: string
    workforceToday: string
    onLeaveToday: string
    workingRemote: string
    leaveUtilization: string
    ofAllocatedLeaveUsedYTD: string
    pendingAssignment: string
    teamApprovalsEnding: string
    usedOf: string
    totalStaff: string
    availableToday: string
    remote: string
    pendingRequestsLabel: string
    hrDepartment: string
  }

  // Messages
  messages: {
    requestApprovedSuccess: string
    requestDeniedSuccess: string
    requestCancelledSuccess: string
    failedToApprove: string
    failedToDeny: string
    failedToCancelRequest: string
    failedToLoadBalance: string
    failedToLoadTeamStats: string
    failedToLoadRequests: string
    confirmCancelRequest: string
    planSaved: string
    planSubmitted: string
    failedToSavePlan: string
    failedToSubmitPlan: string
    failedToLoadPlan: string
    datesAdded: string
    dateRemoved: string
    selectAtLeastOneDate: string
    exceedsAnnualLimit: string
    allDatesAlreadyInPlan: string
    weekendsHolidaysBlocked: string
    failedToLoadCompanyMetrics: string
    failedToLoadDepartmentStats: string
    failedToLoadMonthlyPatterns: string
    failedToLoadRemoteTrends: string
    reportGeneratedSuccess: string
    failedToGenerateReport: string
    generatingReport: string
    failedToLoadApprovedRequests: string
    failedToLoadDeniedRequests: string
  }

  // Tabs
  tabs: {
    pending: string
    approved: string
    denied: string
    employees: string
    calendar: string
    analytics: string
    verification: string
    documents: string
    overview: string
    departments: string
    leavePatterns: string
    capacityPlanning: string
    approvalMetrics: string
  }

  // Roles
  roles: {
    manager: string
    director: string
    executive: string
    employee: string
    hr: string
    admin: string
  }

  // Planning
  planning: {
    holidayPlanning: string
    planYourHolidays: string
    backToDashboard: string
    planningStatus: string
    planningWindow: string
    planStatus: string
    holidayDays: string
    open: string
    closed: string
    addHolidayDates: string
    selectDatesDescription: string
    daysRemaining: string
    priority: string
    reasonOptional: string
    reasonPlaceholder: string
    addSelectedDates: string
    yourHolidayPlan: string
    noDatesSelected: string
    noDatesYet: string
    useCalendar: string
    submitForReview: string
    resubmitForReview: string
    submittedAwaitingReview: string
    planSubmittedMessage: string
    essential: string
    preferred: string
    niceToHave: string
    exceedsMaximum: string
    loadingHolidayPlanning: string
    accessDenied: string
    pleaseLogIn: string
    goToLogin: string
    reviewed: string
    finalized: string
    locked: string
    notCreated: string
  }

  // Team Calendar
  teamCalendar: {
    title: string
    description: string
    clickDateInstruction: string
    legend: string
    onePersonAway: string
    twoThreePeopleAway: string
    fourPlusPeopleAway: string
    noHolidaysPlanned: string
    onePersonOnHoliday: string
    peopleOnHoliday: string
    teamOverview: string
    teamMembersLabel: string
    withHolidayPlans: string
    planningCoverage: string
    loadingTeamCalendar: string
    sun: string
    mon: string
    tue: string
    wed: string
    thu: string
    fri: string
    sat: string
  }

  // Department View
  departmentView: {
    title: string
    description: string
    departmentOverview: string
    noHolidayPlans: string
    noApprovedPlans: string
    teamHolidayPlans: string
    approvedPlansDescription: string
    pendingReview: string
    holidayPlanDialog: string
    noDatesPlanned: string
    loadingDepartmentPlans: string
  }

  // Analytics
  analytics: {
    executiveDashboard: string
    pendingApprovals: string
    monthlyLeaveTrends: string
    monthlyLeaveTrendsDescription: string
    remoteWorkAdoption: string
    remoteWorkAdoptionDescription: string
    peakAbsencePeriods: string
    peakAbsencePeriodsDescription: string
    noPeakAbsencePeriods: string
    absent: string
    expectedOnLeave: string
    departmentBreakdown: string
    available: string
    leaveUtilizationByDepartment: string
    leaveUtilizationByDepartmentDescription: string
    leaveUtilizationRates: string
    leaveUtilizationRatesDescription: string
    keyInsights: string
    keyInsightsDescription: string
    peakSeason: string
    highUtilization: string
    lowUtilization: string
    departmentCapacityAnalysis: string
    departmentCapacityAnalysisDescription: string
    approvalEfficiency: string
    approvalEfficiencyDescription: string
    pendingExecutiveApprovals: string
    pendingExecutiveApprovalsDescription: string
    noPendingExecutiveApprovals: string
    avgLeaveDaysPerEmployee: string
    departmentSummary: string
    leaveUtilizationReport: string
    capacityPlanningReport: string
    managerPerformanceReport: string
    exportAllDataCSV: string
    vacation: string
    personal: string
    medical: string
    daysUsed: string
    daysRemaining: string
    used: string
    remaining: string
    inOffice: string
    onLeave: string
  }

  // Mobile
  mobile: {
    navigationTitle: string
    navigationSubtitle: string
    quickActions: string
    allCaughtUp: string
    noPendingApprovals: string
    coverageAlert: string
    viewMoreRequests: string
    filterAll: string
    filterUrgent: string
    filterRecent: string
    viewAnalytics: string
  }

  // HR
  hr: {
    hrDashboard: string
    hrDashboardDescription: string
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
      nextMonth: "Next Month",
      approve: "Approve",
      deny: "Deny",
      previous: "Previous",
      next: "Next",
      page: "Page",
      of: "of",
      showing: "Showing",
      noResults: "No results",
      notAvailable: "N/A",
      unknown: "Unknown",
      leave: "Leave",
      wfh: "WFH",
      workFromHome: "Work From Home",
      day: "day",
      days: "days",
      working: "working",
      signOut: "Sign Out",
      logOut: "Log out",
      viewAll: "View All",
      viewDetails: "View Details",
      remove: "Remove",
      saveDraft: "Save Draft",
      saveChanges: "Save Changes",
      saving: "Saving...",
      submitting: "Submitting...",
      export: "Export",
      requestLeave: "Request Leave",
      generating: "Generating...",
      profile: "Profile",
      requests: "requests",
    },
    nav: {
      dashboard: "Dashboard",
      calendar: "Calendar",
      requests: "Requests",
      team: "Team",
      analytics: "Analytics",
      profile: "Profile",
      settings: "Settings",
      logout: "Logout",
      leaveManagement: "Leave Management",
      adminDashboard: "Admin Dashboard",
      hrDashboard: "HR Dashboard",
      managerDashboard: "Manager Dashboard",
      executiveDashboard: "Executive Dashboard",
      adminPanel: "Admin Panel",
      planning: "Planning",
      myHolidayPlanning: "My Holiday Planning",
      teamHolidayPlans: "Team Holiday Plans",
      departmentPlans: "Department Plans",
      companyCalendar: "Company Calendar",
      delegation: "Delegation",
      myDashboard: "My Dashboard",
      backToDashboard: "Back to Dashboard",
      backToPersonalDashboard: "Back to Personal Dashboard",
      escalatedApprovals: "Escalated Approvals",
      navigation: "Navigation",
      quickAccessToAllFeatures: "Quick access to all features",
      myLeave: "My Leave",
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
      rejectedRequests: "Rejected Requests",
      summary: {
        title: "Today's Overview",
        noActivity: "No activity for today",
        onLeaveToday: "On Leave Today",
        workingFromHome: "Working from Home",
        substitutingFor: "Substituting For",
        pendingRequests: "Pending Substitute Requests",
        errors: {
          fetchFailed: "Failed to fetch dashboard summary",
          unknown: "An unknown error occurred",
          loadFailed: "Failed to load data"
        }
      },
      recentRequests: "Recent Requests",
      recentRequestsDescription: "Your latest leave and work from home requests",
      noRequestsFound: "No requests found",
      loadingRequests: "Loading requests...",
      companyHolidays: "Company-wide holidays",
      personalLeaveAllocation: "Your personal leave allocation",
      myRecentRequests: "My Recent Requests",
      myRecentRequestsDescription: "Your latest leave and remote work requests",
      noRecentRequests: "No recent requests",
      directReportApprovals: "Direct Report Approvals",
      directReportApprovalsDescription: "Requests from your direct team members",
      noPendingFromTeam: "No pending requests from your team",
      escalatedRequestsTitle: "Escalated Requests Requiring Your Approval",
      escalatedRequestsDescription: "High-level leave requests that need executive approval",
      noEscalatedRequests: "No escalated requests pending your approval",
      vacationDays: "My Vacation Days",
      medicalLeave: "My Medical Leave",
      personalDays: "My Personal Days",
      remoteWorkUsage: "My Remote Work Usage",
      myRequestsDescription: "Requests submitted to your manager",
      pendingTeamApprovals: "Pending Team Approvals",
      pendingTeamApprovalsDescription: "Recent requests from your team members",
      teamQuickStats: "Team Quick Stats",
      reportingManager: "Your Reporting Manager",
      teamLeaveRequests: "Team Leave Requests",
      teamLeaveRequestsDescription: "Manage leave requests from your team",
      teamMembers: "Team Members",
      inOffice: "In Office",
      workingFromHome: "Working from Home",
      onLeave: "On Leave",
      teamRemoteWorkUsage: "Team Remote Work Usage",
    },
    buttons: {
      review: "Review"
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
      partiallyApproved: "Partially Approved",
      active: "Active"
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
    },
    labels: {
      totalTeamSize: "Total team size",
      presentToday: "Present today",
      remoteToday: "Remote today",
      awayToday: "Away today",
      daysUsedThisYear: "Days used this year",
      managedByHR: "Managed by HR",
      wfhThisMonth: "WFH this month",
      avgTeamWfhPercentage: "Average team WFH percentage",
      forLeaveApprovals: "For leave approvals",
      noSuperior: "No Superior Assigned",
      contactHrForSuperior: "Please contact HR to assign your reporting manager",
      workingDaysThisMonth: "working days this month",
      pendingExecutive: "Pending Executive",
      approvedByYou: "Approved by You",
      submitted: "Submitted",
      approvedOn: "Approved on",
      deniedOn: "Denied on",
      totalDays: "Total Days",
      essentialDays: "Essential Days",
      firstHoliday: "First Holiday",
      totalMembers: "Total Members",
      plansSubmitted: "Plans Submitted",
      planningCoverage: "Planning Coverage",
      datesSelected: "dates selected",
      noLimitTrackedByHr: "No limit - tracked by HR",
      noSpecialLeaveTaken: "No special leave taken",
      totalSpecialLeave: "Total special leave",
      requested: "Requested",
      awaitingApproval: "Awaiting approval",
      cancelling: "Cancelling...",
      manageTeam: "Manage Team",
      noPendingRequests: "No pending requests",
      viewAllTeamRequests: "View All Team Requests",
      generateTeamReport: "Generate Team Report",
      denialReason: "Denial reason",
      noApprovedRequests: "No approved requests",
      noDeniedRequests: "No denied requests",
      workforceToday: "Workforce Today",
      onLeaveToday: "On Leave Today",
      workingRemote: "Working Remote",
      leaveUtilization: "Leave Utilization",
      ofAllocatedLeaveUsedYTD: "Of allocated leave used YTD",
      pendingAssignment: "Pending assignment",
      teamApprovalsEnding: "team approvals pending",
      usedOf: "used of",
      totalStaff: "Total Staff",
      availableToday: "Available Today",
      remote: "Remote",
      pendingRequestsLabel: "Pending Requests",
      hrDepartment: "HR Department",
    },
    messages: {
      requestApprovedSuccess: "Request approved successfully",
      requestDeniedSuccess: "Request denied",
      requestCancelledSuccess: "Request cancelled successfully",
      failedToApprove: "Failed to approve request",
      failedToDeny: "Failed to deny request",
      failedToCancelRequest: "Failed to cancel request",
      failedToLoadBalance: "Failed to load leave balance",
      failedToLoadTeamStats: "Failed to load team statistics",
      failedToLoadRequests: "Failed to load pending requests",
      confirmCancelRequest: "Are you sure you want to cancel this request?",
      planSaved: "Holiday plan saved successfully",
      planSubmitted: "Holiday plan submitted for review! You can continue to make changes if needed.",
      failedToSavePlan: "Failed to save plan",
      failedToSubmitPlan: "Failed to submit plan",
      failedToLoadPlan: "Failed to load holiday plan",
      datesAdded: "new date(s) added to your plan",
      dateRemoved: "Date removed from plan",
      selectAtLeastOneDate: "Please select at least one date",
      exceedsAnnualLimit: "Cannot add days. This would exceed the 30-day annual limit",
      allDatesAlreadyInPlan: "All selected dates were already in your plan",
      weekendsHolidaysBlocked: "Weekends and holidays cannot be selected for holiday planning",
      failedToLoadCompanyMetrics: "Failed to load company metrics",
      failedToLoadDepartmentStats: "Failed to load department statistics",
      failedToLoadMonthlyPatterns: "Failed to load monthly patterns",
      failedToLoadRemoteTrends: "Failed to load remote work trends",
      reportGeneratedSuccess: "Report generated successfully!",
      failedToGenerateReport: "Failed to generate report",
      generatingReport: "Generating report...",
      failedToLoadApprovedRequests: "Failed to load approved requests",
      failedToLoadDeniedRequests: "Failed to load denied requests",
    },
    tabs: {
      pending: "Pending",
      approved: "Approved",
      denied: "Denied",
      employees: "Employees",
      calendar: "Calendar",
      analytics: "Analytics",
      verification: "Verification",
      documents: "Documents",
      overview: "Overview",
      departments: "Departments",
      leavePatterns: "Leave Patterns",
      capacityPlanning: "Capacity Planning",
      approvalMetrics: "Approval Metrics",
    },
    roles: {
      manager: "Manager",
      director: "Director",
      executive: "Executive",
      employee: "Employee",
      hr: "HR",
      admin: "Admin",
    },
    planning: {
      holidayPlanning: "Holiday Planning",
      planYourHolidays: "Plan your holidays for next year",
      backToDashboard: "Back to Dashboard",
      planningStatus: "Planning Status",
      planningWindow: "Planning Window",
      planStatus: "Plan Status",
      holidayDays: "Holiday Days",
      open: "OPEN",
      closed: "CLOSED",
      addHolidayDates: "Add Holiday Dates",
      selectDatesDescription: "Select dates for your holiday plan. Weekends and holidays are automatically blocked.",
      daysRemaining: "days remaining out of 30 annual limit",
      priority: "Priority",
      reasonOptional: "Reason (Optional)",
      reasonPlaceholder: "Family vacation, wedding, etc.",
      addSelectedDates: "Add Selected Dates",
      yourHolidayPlan: "Your Holiday Plan",
      noDatesSelected: "dates selected",
      noDatesYet: "No holiday dates planned yet",
      useCalendar: "Use the calendar to add dates",
      submitForReview: "Submit for Review",
      resubmitForReview: "Resubmit for Review",
      submittedAwaitingReview: "Submitted - Awaiting Review",
      planSubmittedMessage: "Your plan has been submitted. You can still make changes and save them. Your manager will see the latest version when reviewing.",
      essential: "Essential",
      preferred: "Preferred",
      niceToHave: "Nice to Have",
      exceedsMaximum: "Exceeds maximum limit",
      loadingHolidayPlanning: "Loading holiday planning...",
      accessDenied: "Access Denied",
      pleaseLogIn: "Please log in to access holiday planning",
      goToLogin: "Go to Login",
      reviewed: "Reviewed",
      finalized: "Finalized",
      locked: "Locked",
      notCreated: "NOT_CREATED",
    },
    teamCalendar: {
      title: "Team Holiday Calendar",
      description: "Visual overview of your team's planned holidays",
      clickDateInstruction: "Click on any date to see who's on holiday",
      legend: "Legend",
      onePersonAway: "1 person away",
      twoThreePeopleAway: "2-3 people away",
      fourPlusPeopleAway: "4+ people away",
      noHolidaysPlanned: "No holidays planned",
      onePersonOnHoliday: "1 person on holiday",
      peopleOnHoliday: "people on holiday",
      teamOverview: "Team Overview",
      teamMembersLabel: "Team Members",
      withHolidayPlans: "With Holiday Plans",
      planningCoverage: "Planning Coverage",
      loadingTeamCalendar: "Loading team calendar...",
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
    },
    departmentView: {
      title: "Department - Holiday Plans",
      description: "View your colleagues' approved holiday plans",
      departmentOverview: "Department Overview",
      noHolidayPlans: "No Holiday Plans Yet",
      noApprovedPlans: "No approved holiday plans to display for",
      teamHolidayPlans: "Team Holiday Plans",
      approvedPlansDescription: "Approved holiday plans from your department colleagues",
      pendingReview: "Pending Review",
      holidayPlanDialog: "Holiday planning for",
      noDatesPlanned: "No specific dates planned",
      loadingDepartmentPlans: "Loading department holiday plans...",
    },
    analytics: {
      executiveDashboard: "Executive Dashboard",
      pendingApprovals: "Pending Approvals",
      monthlyLeaveTrends: "Monthly Leave Trends",
      monthlyLeaveTrendsDescription: "Leave days taken by type over the past 12 months",
      remoteWorkAdoption: "Remote Work Adoption",
      remoteWorkAdoptionDescription: "Remote work days by department (6-month trend)",
      peakAbsencePeriods: "Peak Absence Periods",
      peakAbsencePeriodsDescription: "Upcoming periods with high expected absence rates",
      noPeakAbsencePeriods: "No peak absence periods detected",
      absent: "Absent",
      expectedOnLeave: "employees expected to be on leave",
      departmentBreakdown: "Department breakdown",
      available: "Available",
      leaveUtilizationByDepartment: "Leave Utilization by Department",
      leaveUtilizationByDepartmentDescription: "How departments are using their allocated leave days",
      leaveUtilizationRates: "Leave Utilization Rates",
      leaveUtilizationRatesDescription: "Percentage of allocated leave used by department",
      keyInsights: "Key Insights",
      keyInsightsDescription: "Notable patterns in leave usage",
      peakSeason: "Peak Season",
      highUtilization: "High Utilization",
      lowUtilization: "Low Utilization",
      departmentCapacityAnalysis: "Department Capacity Analysis",
      departmentCapacityAnalysisDescription: "Current workforce availability by department",
      approvalEfficiency: "Approval Efficiency",
      approvalEfficiencyDescription: "Manager response times and approval patterns",
      pendingExecutiveApprovals: "Pending Executive Approvals",
      pendingExecutiveApprovalsDescription: "Leave requests requiring your approval",
      noPendingExecutiveApprovals: "No pending executive approvals",
      avgLeaveDaysPerEmployee: "Avg Leave Days/Employee",
      departmentSummary: "Department Summary",
      leaveUtilizationReport: "Leave Utilization Report",
      capacityPlanningReport: "Capacity Planning Report",
      managerPerformanceReport: "Manager Performance Report",
      exportAllDataCSV: "Export All Data (CSV)",
      vacation: "Vacation",
      personal: "Personal",
      medical: "Medical",
      daysUsed: "Days Used",
      daysRemaining: "Days Remaining",
      used: "used",
      remaining: "remaining",
      inOffice: "In Office",
      onLeave: "On Leave",
    },
    mobile: {
      navigationTitle: "Navigation",
      navigationSubtitle: "Quick access to all features",
      quickActions: "Quick Actions",
      allCaughtUp: "All caught up!",
      noPendingApprovals: "No pending approvals",
      coverageAlert: "Coverage Alert",
      viewMoreRequests: "More Requests",
      filterAll: "All",
      filterUrgent: "Urgent",
      filterRecent: "Recent",
      viewAnalytics: "View Analytics",
    },
    hr: {
      hrDashboard: "HR Dashboard",
      hrDashboardDescription: "Manage employees, review leave requests, and generate reports",
    },
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
      nextMonth: "Luna viitoare",
      approve: "Aprobă",
      deny: "Respinge",
      previous: "Anterior",
      next: "Următor",
      page: "Pagina",
      of: "din",
      showing: "Se afișează",
      noResults: "Niciun rezultat",
      notAvailable: "N/D",
      unknown: "Necunoscut",
      leave: "Concediu",
      wfh: "Lucru de acasă",
      workFromHome: "Lucru de acasă",
      day: "zi",
      days: "zile",
      working: "lucrătoare",
      signOut: "Deconectare",
      logOut: "Deconectare",
      viewAll: "Vezi tot",
      viewDetails: "Vezi detalii",
      remove: "Elimină",
      saveDraft: "Salvează ciornă",
      saveChanges: "Salvează modificări",
      saving: "Se salvează...",
      submitting: "Se trimite...",
      export: "Exportă",
      requestLeave: "Solicită concediu",
      generating: "Se generează...",
      profile: "Profil",
      requests: "cereri",
    },
    nav: {
      dashboard: "Tablou de bord",
      calendar: "Calendar",
      requests: "Cereri",
      team: "Echipă",
      analytics: "Analiză",
      profile: "Profil",
      settings: "Setări",
      logout: "Deconectare",
      leaveManagement: "Gestionare concedii",
      adminDashboard: "Panou administrator",
      hrDashboard: "Panou HR",
      managerDashboard: "Panou manager",
      executiveDashboard: "Panou executiv",
      adminPanel: "Panou admin",
      planning: "Planificare",
      myHolidayPlanning: "Planificarea mea de vacanță",
      teamHolidayPlans: "Planuri vacanță echipă",
      departmentPlans: "Planuri departament",
      companyCalendar: "Calendar companie",
      delegation: "Delegare",
      myDashboard: "Tabloul meu",
      backToDashboard: "Înapoi la tablou",
      backToPersonalDashboard: "Înapoi la tabloul personal",
      escalatedApprovals: "Aprobări escalate",
      navigation: "Navigare",
      quickAccessToAllFeatures: "Acces rapid la toate funcțiile",
      myLeave: "Concediul meu",
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
      rejectedRequests: "Cereri respinse",
      summary: {
        title: "Prezentarea zilei de astăzi",
        noActivity: "Nu există activitate pentru astăzi",
        onLeaveToday: "În concediu astăzi",
        workingFromHome: "Lucru de acasă",
        substitutingFor: "Înlocuitor pentru",
        pendingRequests: "Cereri de înlocuire în așteptare",
        errors: {
          fetchFailed: "Eșec la preluarea rezumatului tabloului de bord",
          unknown: "A apărut o eroare necunoscută",
          loadFailed: "Eșec la încărcarea datelor"
        }
      },
      recentRequests: "Cereri recente",
      recentRequestsDescription: "Ultimele cereri de concediu și lucru de acasă",
      noRequestsFound: "Nu s-au găsit cereri",
      loadingRequests: "Se încarcă cererile...",
      companyHolidays: "Sărbători la nivel de companie",
      personalLeaveAllocation: "Alocarea personală de concediu",
      myRecentRequests: "Cererile mele recente",
      myRecentRequestsDescription: "Ultimele cereri de concediu și lucru la distanță",
      noRecentRequests: "Nicio cerere recentă",
      directReportApprovals: "Aprobări subalterni direcți",
      directReportApprovalsDescription: "Cereri de la membrii echipei tale directe",
      noPendingFromTeam: "Nicio cerere în așteptare de la echipa ta",
      escalatedRequestsTitle: "Cereri escalate care necesită aprobarea ta",
      escalatedRequestsDescription: "Cereri de concediu de nivel înalt care necesită aprobare executivă",
      noEscalatedRequests: "Nicio cerere escalată în așteptarea aprobării tale",
      vacationDays: "Zilele mele de vacanță",
      medicalLeave: "Concediul meu medical",
      personalDays: "Zilele mele personale",
      remoteWorkUsage: "Utilizarea mea de lucru la distanță",
      myRequestsDescription: "Cereri trimise managerului tău",
      pendingTeamApprovals: "Aprobări echipă în așteptare",
      pendingTeamApprovalsDescription: "Cereri recente de la membrii echipei",
      teamQuickStats: "Statistici rapide echipă",
      reportingManager: "Managerul tău direct",
      teamLeaveRequests: "Cereri concediu echipă",
      teamLeaveRequestsDescription: "Gestionează cererile de concediu ale echipei",
      teamMembers: "Membri echipă",
      inOffice: "La birou",
      workingFromHome: "Lucru de acasă",
      onLeave: "În concediu",
      teamRemoteWorkUsage: "Utilizare lucru la distanță echipă",
    },
    buttons: {
      review: "Revizuire"
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
      partiallyApproved: "Aprobat parțial",
      active: "Activ"
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
    },
    labels: {
      totalTeamSize: "Dimensiunea totală a echipei",
      presentToday: "Prezenți astăzi",
      remoteToday: "La distanță astăzi",
      awayToday: "Absenți astăzi",
      daysUsedThisYear: "Zile folosite anul acesta",
      managedByHR: "Gestionat de HR",
      wfhThisMonth: "Lucru de acasă luna aceasta",
      avgTeamWfhPercentage: "Procentajul mediu WFH al echipei",
      forLeaveApprovals: "Pentru aprobări concediu",
      noSuperior: "Niciun superior alocat",
      contactHrForSuperior: "Contactați HR pentru a vă aloca managerul direct",
      workingDaysThisMonth: "zile lucrătoare luna aceasta",
      pendingExecutive: "În așteptare executiv",
      approvedByYou: "Aprobat de tine",
      submitted: "Trimis",
      approvedOn: "Aprobat pe",
      deniedOn: "Respins pe",
      totalDays: "Total zile",
      essentialDays: "Zile esențiale",
      firstHoliday: "Prima vacanță",
      totalMembers: "Total membri",
      plansSubmitted: "Planuri trimise",
      planningCoverage: "Acoperire planificare",
      datesSelected: "date selectate",
      noLimitTrackedByHr: "Fără limită - gestionat de HR",
      noSpecialLeaveTaken: "Niciun concediu special folosit",
      totalSpecialLeave: "Total concediu special",
      requested: "Solicitat",
      awaitingApproval: "În așteptarea aprobării",
      cancelling: "Se anulează...",
      manageTeam: "Gestionează echipa",
      noPendingRequests: "Nicio cerere în așteptare",
      viewAllTeamRequests: "Vezi toate cererile echipei",
      generateTeamReport: "Generează raport echipă",
      denialReason: "Motivul respingerii",
      noApprovedRequests: "Nicio cerere aprobată",
      noDeniedRequests: "Nicio cerere respinsă",
      workforceToday: "Forța de muncă astăzi",
      onLeaveToday: "În concediu astăzi",
      workingRemote: "Lucru la distanță",
      leaveUtilization: "Utilizare concediu",
      ofAllocatedLeaveUsedYTD: "Din concediul alocat folosit anul acesta",
      pendingAssignment: "Așteptare alocare",
      teamApprovalsEnding: "aprobări echipă în așteptare",
      usedOf: "folosite din",
      totalStaff: "Total personal",
      availableToday: "Disponibil astăzi",
      remote: "La distanță",
      pendingRequestsLabel: "Cereri în așteptare",
      hrDepartment: "Departament HR",
    },
    messages: {
      requestApprovedSuccess: "Cererea a fost aprobată cu succes",
      requestDeniedSuccess: "Cererea a fost respinsă",
      requestCancelledSuccess: "Cererea a fost anulată cu succes",
      failedToApprove: "Nu s-a putut aproba cererea",
      failedToDeny: "Nu s-a putut respinge cererea",
      failedToCancelRequest: "Nu s-a putut anula cererea",
      failedToLoadBalance: "Nu s-a putut încărca soldul de concediu",
      failedToLoadTeamStats: "Nu s-au putut încărca statisticile echipei",
      failedToLoadRequests: "Nu s-au putut încărca cererile în așteptare",
      confirmCancelRequest: "Sigur doriți să anulați această cerere?",
      planSaved: "Planul de vacanță a fost salvat cu succes",
      planSubmitted: "Planul de vacanță a fost trimis pentru revizuire! Puteți continua să faceți modificări.",
      failedToSavePlan: "Nu s-a putut salva planul",
      failedToSubmitPlan: "Nu s-a putut trimite planul",
      failedToLoadPlan: "Nu s-a putut încărca planul de vacanță",
      datesAdded: "dată(e) noi adăugate la plan",
      dateRemoved: "Dată eliminată din plan",
      selectAtLeastOneDate: "Selectați cel puțin o dată",
      exceedsAnnualLimit: "Nu se pot adăuga zile. Aceasta ar depăși limita anuală de 30 de zile",
      allDatesAlreadyInPlan: "Toate datele selectate erau deja în plan",
      weekendsHolidaysBlocked: "Weekend-urile și sărbătorile nu pot fi selectate pentru planificarea vacanței",
      failedToLoadCompanyMetrics: "Nu s-au putut încărca metricile companiei",
      failedToLoadDepartmentStats: "Nu s-au putut încărca statisticile departamentului",
      failedToLoadMonthlyPatterns: "Nu s-au putut încărca tiparele lunare",
      failedToLoadRemoteTrends: "Nu s-au putut încărca tendințele de lucru la distanță",
      reportGeneratedSuccess: "Raportul a fost generat cu succes!",
      failedToGenerateReport: "Nu s-a putut genera raportul",
      generatingReport: "Se generează raportul...",
      failedToLoadApprovedRequests: "Nu s-au putut încărca cererile aprobate",
      failedToLoadDeniedRequests: "Nu s-au putut încărca cererile respinse",
    },
    tabs: {
      pending: "În așteptare",
      approved: "Aprobate",
      denied: "Respinse",
      employees: "Angajați",
      calendar: "Calendar",
      analytics: "Analiză",
      verification: "Verificare",
      documents: "Documente",
      overview: "Prezentare generală",
      departments: "Departamente",
      leavePatterns: "Tipare concediu",
      capacityPlanning: "Planificare capacitate",
      approvalMetrics: "Metrici aprobări",
    },
    roles: {
      manager: "Manager",
      director: "Director",
      executive: "Executiv",
      employee: "Angajat",
      hr: "HR",
      admin: "Admin",
    },
    planning: {
      holidayPlanning: "Planificare vacanță",
      planYourHolidays: "Planifică-ți vacanțele pentru anul viitor",
      backToDashboard: "Înapoi la tablou",
      planningStatus: "Starea planificării",
      planningWindow: "Fereastra de planificare",
      planStatus: "Starea planului",
      holidayDays: "Zile de vacanță",
      open: "DESCHIS",
      closed: "ÎNCHIS",
      addHolidayDates: "Adaugă date de vacanță",
      selectDatesDescription: "Selectează datele pentru planul de vacanță. Weekend-urile și sărbătorile sunt blocate automat.",
      daysRemaining: "zile rămase din limita anuală de 30",
      priority: "Prioritate",
      reasonOptional: "Motiv (Opțional)",
      reasonPlaceholder: "Vacanță în familie, nuntă, etc.",
      addSelectedDates: "Adaugă datele selectate",
      yourHolidayPlan: "Planul tău de vacanță",
      noDatesSelected: "date selectate",
      noDatesYet: "Nicio dată de vacanță planificată încă",
      useCalendar: "Folosește calendarul pentru a adăuga date",
      submitForReview: "Trimite pentru revizuire",
      resubmitForReview: "Retrimite pentru revizuire",
      submittedAwaitingReview: "Trimis - În așteptarea revizuirii",
      planSubmittedMessage: "Planul tău a fost trimis. Poți încă face modificări și le poți salva. Managerul tău va vedea ultima versiune la revizuire.",
      essential: "Esențial",
      preferred: "Preferat",
      niceToHave: "Opțional",
      exceedsMaximum: "Depășește limita maximă",
      loadingHolidayPlanning: "Se încarcă planificarea vacanței...",
      accessDenied: "Acces interzis",
      pleaseLogIn: "Autentificați-vă pentru a accesa planificarea vacanțelor",
      goToLogin: "Mergi la autentificare",
      reviewed: "Revizuit",
      finalized: "Finalizat",
      locked: "Blocat",
      notCreated: "NECREAT",
    },
    teamCalendar: {
      title: "Calendar vacanțe echipă",
      description: "Prezentare vizuală a vacanțelor planificate ale echipei",
      clickDateInstruction: "Apasă pe orice dată pentru a vedea cine este în vacanță",
      legend: "Legendă",
      onePersonAway: "1 persoană absentă",
      twoThreePeopleAway: "2-3 persoane absente",
      fourPlusPeopleAway: "4+ persoane absente",
      noHolidaysPlanned: "Nicio vacanță planificată",
      onePersonOnHoliday: "1 persoană în vacanță",
      peopleOnHoliday: "persoane în vacanță",
      teamOverview: "Prezentare echipă",
      teamMembersLabel: "Membri echipă",
      withHolidayPlans: "Cu planuri de vacanță",
      planningCoverage: "Acoperire planificare",
      loadingTeamCalendar: "Se încarcă calendarul echipei...",
      sun: "Dum",
      mon: "Lun",
      tue: "Mar",
      wed: "Mie",
      thu: "Joi",
      fri: "Vin",
      sat: "Sâm",
    },
    departmentView: {
      title: "Departament - Planuri vacanță",
      description: "Vizualizați planurile de vacanță aprobate ale colegilor",
      departmentOverview: "Prezentare departament",
      noHolidayPlans: "Niciun plan de vacanță încă",
      noApprovedPlans: "Niciun plan de vacanță aprobat de afișat pentru",
      teamHolidayPlans: "Planuri vacanță echipă",
      approvedPlansDescription: "Planuri de vacanță aprobate de la colegii din departament",
      pendingReview: "În așteptarea revizuirii",
      holidayPlanDialog: "Planificarea vacanței pentru",
      noDatesPlanned: "Nicio dată specifică planificată",
      loadingDepartmentPlans: "Se încarcă planurile de vacanță ale departamentului...",
    },
    analytics: {
      executiveDashboard: "Panou executiv",
      pendingApprovals: "Aprobări în așteptare",
      monthlyLeaveTrends: "Tendințe lunare concediu",
      monthlyLeaveTrendsDescription: "Zile de concediu pe tip în ultimele 12 luni",
      remoteWorkAdoption: "Adoptarea lucrului la distanță",
      remoteWorkAdoptionDescription: "Zile de lucru la distanță pe departament (tendință 6 luni)",
      peakAbsencePeriods: "Perioade de vârf de absență",
      peakAbsencePeriodsDescription: "Perioade viitoare cu rate ridicate de absență așteptate",
      noPeakAbsencePeriods: "Nu au fost detectate perioade de vârf de absență",
      absent: "Absent",
      expectedOnLeave: "angajați așteptați în concediu",
      departmentBreakdown: "Detalii pe departamente",
      available: "Disponibil",
      leaveUtilizationByDepartment: "Utilizare concediu pe departament",
      leaveUtilizationByDepartmentDescription: "Cum folosesc departamentele zilele de concediu alocate",
      leaveUtilizationRates: "Rate utilizare concediu",
      leaveUtilizationRatesDescription: "Procentul de concediu alocat folosit pe departament",
      keyInsights: "Informații cheie",
      keyInsightsDescription: "Tipare notabile în utilizarea concediului",
      peakSeason: "Sezonul de vârf",
      highUtilization: "Utilizare ridicată",
      lowUtilization: "Utilizare scăzută",
      departmentCapacityAnalysis: "Analiza capacității departamentului",
      departmentCapacityAnalysisDescription: "Disponibilitatea curentă a forței de muncă pe departament",
      approvalEfficiency: "Eficiența aprobărilor",
      approvalEfficiencyDescription: "Timpii de răspuns și tiparele de aprobare ale managerilor",
      pendingExecutiveApprovals: "Aprobări executive în așteptare",
      pendingExecutiveApprovalsDescription: "Cereri de concediu care necesită aprobarea dvs.",
      noPendingExecutiveApprovals: "Nicio aprobare executivă în așteptare",
      avgLeaveDaysPerEmployee: "Media zile concediu/angajat",
      departmentSummary: "Rezumat departament",
      leaveUtilizationReport: "Raport utilizare concediu",
      capacityPlanningReport: "Raport planificare capacitate",
      managerPerformanceReport: "Raport performanță manageri",
      exportAllDataCSV: "Exportă toate datele (CSV)",
      vacation: "Vacanță",
      personal: "Personal",
      medical: "Medical",
      daysUsed: "Zile folosite",
      daysRemaining: "Zile rămase",
      used: "folosit",
      remaining: "rămas",
      inOffice: "La birou",
      onLeave: "În concediu",
    },
    mobile: {
      navigationTitle: "Navigare",
      navigationSubtitle: "Acces rapid la toate funcțiile",
      quickActions: "Acțiuni rapide",
      allCaughtUp: "Totul este la zi!",
      noPendingApprovals: "Nicio aprobare în așteptare",
      coverageAlert: "Alertă acoperire",
      viewMoreRequests: "Mai multe cereri",
      filterAll: "Toate",
      filterUrgent: "Urgente",
      filterRecent: "Recente",
      viewAnalytics: "Vezi analize",
    },
    hr: {
      hrDashboard: "Panou HR",
      hrDashboardDescription: "Gestionează angajații, revizuiește cererile de concediu și generează rapoarte",
    },
  }
}

export function getTranslations(language: Language): Translations {
  return translations[language]
}
