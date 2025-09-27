# PDF Form Fields Guide

## Creating a PDF Template with Form Fields

### Tools You Can Use:
1. **Adobe Acrobat Pro** - Most comprehensive tool
2. **LibreOffice Draw** - Free, open-source option
3. **PDF Escape** - Online tool
4. **Foxit PhantomPDF** - Commercial alternative

### Steps to Add Form Fields:

#### Using Adobe Acrobat Pro:
1. Open your PDF template
2. Go to Tools → Prepare Form
3. Acrobat will auto-detect form fields or you can add manually
4. Add fields by clicking the field type and drawing on the PDF

#### Field Naming Convention:
For the leave management system, use these exact field names:

**Employee Information:**
- `employee_name` - Full name of employee
- `employee_id` - Employee ID
- `department` - Department name
- `position` - Job position
- `manager_name` - Manager's full name

**Leave Request Details:**
- `request_number` - Leave request number (e.g., LR-2025-0006)
- `leave_type` - Type of leave (Annual Leave, Sick Leave, etc.)
- `leave_dates` - Formatted date range
- `start_date` - Start date only
- `end_date` - End date only
- `total_days` - Number of days
- `leave_reason` - Reason for leave
- `request_date` - Date request was submitted

**Substitute Information:**
- `substitute_name` - Name of substitute employee
- `substitute_email` - Substitute's email

**Romanian Specific Fields:**
- `numele_angajatului` - Employee name in Romanian
- `motivul_absentei` - Leave reason in Romanian
- `perioada_absentei` - Leave period in Romanian
- `persoana_inlocuitoare` - Substitute person in Romanian
- `comentarii` - Comments in Romanian

**Checkboxes for Approval:**
- `manager_approved` - Checkbox for manager approval
- `manager_rejected` - Checkbox for manager rejection
- `director_approved` - Checkbox for director approval
- `director_rejected` - Checkbox for director rejection

### Best Practices:

1. **Consistent Naming**: Use lowercase with underscores for field names
2. **Field Types**: 
   - Use Text Fields for most data
   - Use Checkboxes for yes/no options
   - Use Date Fields for dates if you want formatting
3. **Field Properties**:
   - Set fields as "Read Only" if they shouldn't be edited
   - Set appropriate font size (usually 10-12pt)
   - Align text appropriately (left for most, center for some)
4. **Signature Areas**: Leave blank areas for signatures - these will be added programmatically

### Testing Your Template:

1. Save the PDF with form fields
2. Upload it to the system
3. The system will automatically detect and list all field names
4. Map the fields to data using the field names above

### Example Field Mapping:

```javascript
// The system will automatically fill these fields:
form.getTextField('employee_name').setText('John Doe')
form.getTextField('department').setText('Engineering')
form.getTextField('leave_type').setText('Annual Leave')
form.getTextField('leave_dates').setText('1-5 July 2024')
```

### Advantages of Form Fields:

1. **Precise Positioning**: Fields are exactly where you place them
2. **No Coordinate Calculations**: No need to calculate X,Y positions
3. **Consistent Formatting**: Fields maintain their formatting
4. **Easy Updates**: Can modify template without changing code
5. **Professional Appearance**: Text aligns perfectly within fields

### Migration Strategy:

1. Take your existing PDF template
2. Open in Acrobat Pro or similar tool
3. Add form fields over the blank lines/spaces
4. Name fields according to the convention above
5. Save and upload the new template
6. The system will automatically use form field filling instead of coordinate-based placement