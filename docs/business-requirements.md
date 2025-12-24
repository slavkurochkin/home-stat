# Business Requirements Document
## Utility Management Application

### 1. Executive Summary

The Utility Management Application is a web-based system designed to help users track, manage, and analyze their utility bills and consumption. The application supports multiple utility types (water, electricity, gas, and custom utilities), provides analytics and insights, sends alerts and reminders, and supports multi-user households.

### 2. Business Objectives

- **Primary Goal**: Provide users with a centralized platform to manage all utility bills and track consumption patterns
- **User Empowerment**: Enable users to make informed decisions about utility usage through analytics and insights
- **Cost Management**: Help users identify trends and anomalies in utility costs
- **Proactive Management**: Send timely alerts and reminders to prevent missed payments and monitor usage thresholds
- **Scalability**: Support multiple users and households with secure authentication

### 3. Target Users

- **Primary Users**: Homeowners and renters managing household utilities
- **Secondary Users**: Property managers tracking multiple properties
- **User Characteristics**: 
  - Basic to intermediate technical proficiency
  - Need for organized bill tracking
  - Interest in cost optimization and usage monitoring

### 4. User Stories

#### 4.1 Authentication & User Management

**US-001: User Registration**
- As a new user, I want to create an account with email and password so that I can access the application securely.

**US-002: User Login**
- As a registered user, I want to log in with my credentials so that I can access my utility data.

**US-003: User Profile Management**
- As a user, I want to view and update my profile information (name, email, password) so that I can keep my account information current.

**US-004: Multi-User Household**
- As a user, I want to invite other users to my household so that we can collaboratively manage utilities.

#### 4.2 Utility Management

**US-005: Create Custom Utility Type**
- As a user, I want to create custom utility types (e.g., internet, phone, cable) so that I can track all my utilities, not just standard ones.

**US-006: Add Utility Bill**
- As a user, I want to enter a new utility bill with amount, date, and usage so that I can maintain a complete record of my expenses.

**US-007: View Bill History**
- As a user, I want to view a list of all my bills sorted by date so that I can review my payment history.

**US-008: Edit Bill**
- As a user, I want to edit bill details so that I can correct any errors in my entries.

**US-009: Delete Bill**
- As a user, I want to delete a bill entry so that I can remove incorrect or duplicate records.

**US-010: View Bills by Utility Type**
- As a user, I want to filter bills by utility type so that I can focus on specific utilities.

#### 4.3 Analytics & Insights

**US-011: View Cost Trends**
- As a user, I want to see cost trends over time (monthly, quarterly, yearly) so that I can identify patterns in my utility expenses.

**US-012: Compare Utility Costs**
- As a user, I want to compare costs across different utility types so that I can understand which utilities consume the most budget.

**US-013: Usage Analysis**
- As a user, I want to view usage trends (kWh, gallons, etc.) over time so that I can monitor my consumption patterns.

**US-014: Cost Forecasting**
- As a user, I want to see projected costs based on historical data so that I can plan my budget.

**US-015: Visual Charts**
- As a user, I want to see charts and graphs of my utility data so that I can quickly understand trends visually.

#### 4.4 Alerts & Notifications

**US-016: Bill Reminder**
- As a user, I want to set reminders for upcoming bill due dates so that I never miss a payment.

**US-017: Usage Threshold Alert**
- As a user, I want to set usage thresholds and receive alerts when exceeded so that I can identify unusual consumption.

**US-018: Cost Threshold Alert**
- As a user, I want to set cost thresholds and receive alerts when bills exceed a certain amount so that I can manage my budget.

**US-019: View Alerts**
- As a user, I want to view all my active alerts and notifications so that I can manage them effectively.

**US-020: Configure Alert Preferences**
- As a user, I want to configure how I receive alerts (email, in-app) so that I can choose my preferred notification method.

### 5. Functional Requirements

#### 5.1 Authentication Module

**FR-001: Registration**
- System shall allow users to register with:
  - Email address (must be unique and valid format)
  - Password (minimum 8 characters, must include letters and numbers)
  - Full name
- System shall validate email format and password strength
- System shall hash passwords before storage
- System shall send verification email (optional enhancement)

**FR-002: Login**
- System shall authenticate users with email and password
- System shall generate and return JWT token upon successful authentication
- System shall maintain session for authenticated users
- System shall handle invalid credentials gracefully

**FR-003: Password Management**
- System shall allow users to change their password
- System shall require current password for password changes
- System shall validate new password strength

#### 5.2 Utility Management Module

**FR-004: Utility Type Management**
- System shall support predefined utility types: Water, Electricity, Gas
- System shall allow users to create custom utility types with:
  - Name (required, unique per user)
  - Description (optional)
  - Unit of measurement (optional, e.g., kWh, gallons, cubic feet)
- System shall allow users to edit and delete their custom utility types
- System shall prevent deletion of utility types that have associated bills

**FR-005: Bill Entry**
- System shall allow users to enter bills with:
  - Utility type (required, from user's available types)
  - Bill amount (required, positive number, 2 decimal places)
  - Bill date (required, date picker)
  - Due date (optional)
  - Usage amount (optional, positive number)
  - Notes (optional, text field)
- System shall validate all required fields
- System shall store bills with user association and timestamp

**FR-006: Bill Management**
- System shall allow users to:
  - View all bills (paginated list)
  - Filter bills by utility type, date range
  - Sort bills by date, amount, utility type
  - Edit bill details
  - Delete bills (with confirmation)
- System shall display bills in a user-friendly table/card format

#### 5.3 Analytics Module

**FR-007: Cost Analytics**
- System shall calculate and display:
  - Total cost by utility type (current month, year)
  - Average monthly cost per utility type
  - Cost trends over time (line charts)
  - Year-over-year comparisons
  - Cost distribution (pie charts)

**FR-008: Usage Analytics**
- System shall calculate and display:
  - Total usage by utility type
  - Average usage per period
  - Usage trends over time (line charts)
  - Usage comparisons between periods

**FR-009: Forecasting**
- System shall provide cost forecasts based on:
  - Historical average
  - Seasonal trends (if sufficient data)
  - Recent trend analysis

**FR-010: Data Visualization**
- System shall provide interactive charts:
  - Line charts for trends over time
  - Bar charts for comparisons
  - Pie charts for distribution
  - Date range selection for custom analysis

#### 5.4 Alerts & Notifications Module

**FR-011: Bill Reminders**
- System shall allow users to create bill reminders with:
  - Utility type
  - Reminder date (before due date)
  - Recurrence (one-time, monthly, quarterly)
- System shall send notifications on reminder dates
- System shall mark bills as "reminder sent" to avoid duplicates

**FR-012: Usage Threshold Alerts**
- System shall allow users to set usage thresholds per utility type
- System shall compare current usage against threshold when new bill is entered
- System shall trigger alert if threshold is exceeded
- System shall allow users to set threshold as absolute value or percentage increase

**FR-013: Cost Threshold Alerts**
- System shall allow users to set cost thresholds per utility type
- System shall compare bill amount against threshold
- System shall trigger alert if threshold is exceeded
- System shall support both absolute and percentage-based thresholds

**FR-014: Alert Management**
- System shall display all active alerts in a dashboard
- System shall allow users to:
  - View alert details
  - Acknowledge/dismiss alerts
  - Edit alert configurations
  - Delete alerts

### 6. Data Models

#### 6.1 User Model

```
User {
  id: UUID (Primary Key)
  email: String (Unique, Required)
  password_hash: String (Required)
  full_name: String (Required)
  created_at: Timestamp
  updated_at: Timestamp
  is_active: Boolean (Default: true)
}
```

#### 6.2 Household Model

```
Household {
  id: UUID (Primary Key)
  name: String (Required)
  created_by: UUID (Foreign Key -> User)
  created_at: Timestamp
  updated_at: Timestamp
}
```

#### 6.3 Household Member Model

```
HouseholdMember {
  id: UUID (Primary Key)
  household_id: UUID (Foreign Key -> Household)
  user_id: UUID (Foreign Key -> User)
  role: Enum ['owner', 'member'] (Default: 'member')
  joined_at: Timestamp
}
```

#### 6.4 Utility Type Model

```
UtilityType {
  id: UUID (Primary Key)
  user_id: UUID (Foreign Key -> User, Nullable for system types)
  name: String (Required)
  description: String (Optional)
  unit_of_measurement: String (Optional, e.g., 'kWh', 'gallons', 'cubic feet')
  is_system_type: Boolean (Default: false)
  created_at: Timestamp
  updated_at: Timestamp
}
```

#### 6.5 Bill Model

```
Bill {
  id: UUID (Primary Key)
  user_id: UUID (Foreign Key -> User)
  household_id: UUID (Foreign Key -> Household, Optional)
  utility_type_id: UUID (Foreign Key -> UtilityType)
  amount: Decimal(10,2) (Required, > 0)
  bill_date: Date (Required)
  due_date: Date (Optional)
  usage_amount: Decimal(10,2) (Optional, > 0)
  notes: Text (Optional)
  created_at: Timestamp
  updated_at: Timestamp
}
```

#### 6.6 Alert Model

```
Alert {
  id: UUID (Primary Key)
  user_id: UUID (Foreign Key -> User)
  alert_type: Enum ['bill_reminder', 'usage_threshold', 'cost_threshold']
  utility_type_id: UUID (Foreign Key -> UtilityType, Optional)
  configuration: JSON (Alert-specific settings)
  is_active: Boolean (Default: true)
  last_triggered: Timestamp (Optional)
  created_at: Timestamp
  updated_at: Timestamp
}
```

#### 6.7 Notification Model

```
Notification {
  id: UUID (Primary Key)
  user_id: UUID (Foreign Key -> User)
  alert_id: UUID (Foreign Key -> Alert, Optional)
  title: String (Required)
  message: String (Required)
  notification_type: Enum ['info', 'warning', 'alert']
  is_read: Boolean (Default: false)
  created_at: Timestamp
}
```

### 7. Business Rules

**BR-001: User Isolation**
- Users can only view and manage their own bills and data
- Users in the same household can optionally share data (future enhancement)

**BR-002: Utility Type Ownership**
- System utility types (Water, Electricity, Gas) are available to all users
- Custom utility types belong to the user who created them
- Users cannot delete system utility types

**BR-003: Bill Validation**
- Bill amounts must be positive numbers
- Bill dates cannot be in the future (with exception for estimated bills)
- Usage amounts must be positive if provided
- Bills must be associated with a valid utility type

**BR-004: Alert Triggering**
- Bill reminders trigger on the specified reminder date
- Usage threshold alerts trigger when a new bill is entered with usage exceeding the threshold
- Cost threshold alerts trigger when a new bill is entered with amount exceeding the threshold
- Alerts are only sent for active alerts

**BR-005: Data Retention**
- Bills and utility data are retained indefinitely unless deleted by user
- Deleted bills are permanently removed (no soft delete in initial version)

**BR-006: Multi-User Households**
- Household owners can invite users via email
- Invited users must have an account (or create one)
- Household members can view and manage bills for the household
- Only household owners can delete the household

### 8. User Workflows

#### 8.1 New User Onboarding

1. User visits application
2. User clicks "Sign Up"
3. User enters email, password, and full name
4. System validates input and creates account
5. User is logged in automatically
6. System displays welcome screen with tutorial (optional)
7. User is prompted to create their first utility type or enter a bill

#### 8.2 Adding a Utility Bill

1. User navigates to "Add Bill" page
2. User selects utility type (or creates new one)
3. User enters bill amount, date, and optional details
4. System validates input
5. System saves bill and displays confirmation
6. System checks for any applicable alerts (thresholds)
7. User is redirected to bill list or dashboard

#### 8.3 Viewing Analytics

1. User navigates to "Analytics" page
2. User selects date range (default: last 12 months)
3. User selects utility types to analyze (default: all)
4. System calculates and displays:
   - Cost trends chart
   - Usage trends chart
   - Cost distribution
   - Summary statistics
5. User can interact with charts (zoom, filter, etc.)

#### 8.4 Setting Up Alerts

1. User navigates to "Alerts" page
2. User clicks "Create Alert"
3. User selects alert type (bill reminder, usage threshold, cost threshold)
4. User configures alert parameters:
   - For bill reminder: utility type, reminder date, recurrence
   - For usage threshold: utility type, threshold value, comparison method
   - For cost threshold: utility type, threshold amount, comparison method
5. System saves alert configuration
6. System displays confirmation and alert status

### 9. Non-Functional Requirements

**NFR-001: Performance**
- Page load time should be under 2 seconds
- API response time should be under 500ms for standard operations
- Analytics calculations should complete within 3 seconds

**NFR-002: Security**
- All passwords must be hashed using bcrypt
- JWT tokens must expire after 24 hours
- All API endpoints must be authenticated (except registration/login)
- Input validation must prevent SQL injection and XSS attacks

**NFR-003: Usability**
- Application must be responsive (mobile, tablet, desktop)
- User interface must be intuitive and require minimal training
- Error messages must be clear and actionable

**NFR-004: Reliability**
- System uptime target: 99.5%
- Data must be backed up daily
- System must handle concurrent users (target: 1000+ concurrent users)

**NFR-005: Scalability**
- System must support horizontal scaling
- Database must be optimized for query performance
- Microservices architecture must allow independent scaling

### 10. Out of Scope (Initial Version)

- Payment processing integration
- Bill scanning/OCR for automatic entry
- Integration with utility provider APIs
- Mobile native applications
- Email notifications (in-app only for initial version)
- Data export functionality
- Bill sharing with external users
- Advanced reporting and PDF generation

### 11. Success Criteria

- Users can successfully register and log in
- Users can create custom utility types
- Users can enter and manage bills for all utility types
- Analytics provide meaningful insights with accurate calculations
- Alerts trigger correctly based on configured rules
- Application is responsive and performs well on all devices
- System handles errors gracefully with user-friendly messages

