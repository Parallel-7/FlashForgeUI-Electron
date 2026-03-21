# Design Pattern Applications of Principles

## Law of Demeter (LoD) Examples

### Violation Example
```python
class Wallet:
    def __init__(self, money):
        self.money = money

class Customer:
    def __init__(self, wallet):
        self.wallet = wallet

class Paperboy:
    def collect_payment(self, customer, payment):
        # Violation: reaches through customer to access wallet
        if customer.wallet.money >= payment:
            customer.wallet.money -= payment
            return True
        return False
```

**Problem**: Paperboy knows too much about Customer's internal structure (wallet)

### Correct Approach
```python
class Wallet:
    def __init__(self, money):
        self.money = money
    
    def has_enough(self, amount):
        return self.money >= amount
    
    def deduct(self, amount):
        self.money -= amount

class Customer:
    def __init__(self, wallet):
        self.wallet = wallet
    
    def pay(self, amount):
        if self.wallet.has_enough(amount):
            self.wallet.deduct(amount)
            return True
        return False

class Paperboy:
    def collect_payment(self, customer, payment):
        # Correct: only talks to customer directly
        return customer.pay(payment)
```

**Benefit**: Paperboy only depends on Customer interface, not implementation details

## Command Query Separation (CQS) Examples

### Violation Example
```javascript
class Stack {
    items = [];
    
    // Violation: both modifies state AND returns value
    pop() {
        if (this.items.length === 0) return null;
        return this.items.pop();
    }
}
```

**Note**: While this violates CQS, it's often acceptable for pragmatic reasons

### Preferred Approach
```javascript
class Stack {
    items = [];
    
    // Query: no side effects
    peek() {
        if (this.items.length === 0) return null;
        return this.items[this.items.length - 1];
    }
    
    // Command: modifies state, returns void/boolean for success
    pop() {
        if (this.items.length > 0) {
            this.items.pop();
            return true;
        }
        return false;
    }
}

// Usage
const top = stack.peek();  // Query
if (stack.pop()) {  // Command
    console.log('Popped:', top);
}
```

## Design by Contract (DbC) Examples

### Example with Preconditions and Postconditions
```python
class BankAccount:
    def __init__(self, initial_balance):
        assert initial_balance >= 0, "Initial balance must be non-negative"
        self.balance = initial_balance
    
    def withdraw(self, amount):
        # Preconditions
        assert amount > 0, "Withdrawal amount must be positive"
        assert self.balance >= amount, "Insufficient funds"
        
        old_balance = self.balance
        
        # Execute
        self.balance -= amount
        
        # Postcondition
        assert self.balance == old_balance - amount, "Balance calculation error"
        assert self.balance >= 0, "Invariant violated: balance cannot be negative"
        
        return self.balance
    
    def deposit(self, amount):
        # Precondition
        assert amount > 0, "Deposit amount must be positive"
        
        old_balance = self.balance
        
        # Execute
        self.balance += amount
        
        # Postcondition
        assert self.balance == old_balance + amount, "Balance calculation error"
        
        return self.balance
```

## Idempotency Examples

### Non-Idempotent Operation
```python
# BAD: Not idempotent
def transfer_money(from_account, to_account, amount):
    from_account.balance -= amount
    to_account.balance += amount
    # If this runs twice, money transfers twice!
```

### Idempotent with Request ID
```python
class TransferService:
    def __init__(self):
        self.processed_requests = {}
    
    def transfer_money(self, request_id, from_account, to_account, amount):
        # Check if already processed
        if request_id in self.processed_requests:
            return self.processed_requests[request_id]
        
        # Process transfer
        from_account.balance -= amount
        to_account.balance += amount
        
        result = {
            'status': 'success',
            'transaction_id': request_id,
            'amount': amount
        }
        
        # Store result
        self.processed_requests[request_id] = result
        
        return result
```

**Benefit**: Same request_id always returns same result, safe to retry

### Natural Idempotency
```python
# Naturally idempotent operations
def set_user_email(user_id, email):
    user = get_user(user_id)
    user.email = email  # Setting to same value multiple times = same result
    save(user)

def delete_user(user_id):
    user = get_user(user_id)
    if user:
        delete(user)  # Deleting already deleted user = no change
```

## Separation of Concerns (SoC) Examples

### Poor Separation
```javascript
// All concerns mixed together
function handleUserRegistration(data) {
    // Validation
    if (!data.email.includes('@')) throw new Error('Invalid email');
    
    // Business logic
    const user = { 
        id: generateId(), 
        email: data.email, 
        created: new Date() 
    };
    
    // Data persistence
    db.insert('users', user);
    
    // Notification
    sendEmail(user.email, 'Welcome!');
    
    // Logging
    console.log(`User ${user.id} registered`);
    
    // Response formatting
    return { status: 'success', userId: user.id };
}
```

### Good Separation
```javascript
// Validation layer
class UserValidator {
    validate(data) {
        if (!data.email.includes('@')) 
            throw new Error('Invalid email');
    }
}

// Business logic layer
class UserService {
    constructor(repository, emailService, logger) {
        this.repository = repository;
        this.emailService = emailService;
        this.logger = logger;
    }
    
    async registerUser(data) {
        const user = {
            id: generateId(),
            email: data.email,
            created: new Date()
        };
        
        await this.repository.save(user);
        await this.emailService.sendWelcome(user.email);
        this.logger.info(`User ${user.id} registered`);
        
        return user;
    }
}

// Data access layer
class UserRepository {
    async save(user) {
        return db.insert('users', user);
    }
}

// Communication layer
class EmailService {
    async sendWelcome(email) {
        return sendEmail(email, 'Welcome!');
    }
}

// Presentation layer
class UserController {
    constructor(validator, userService) {
        this.validator = validator;
        this.userService = userService;
    }
    
    async register(request) {
        this.validator.validate(request.body);
        const user = await this.userService.registerUser(request.body);
        return { status: 'success', userId: user.id };
    }
}
```

## Convention over Configuration (CoC) Examples

### Without CoC (Heavy Configuration)
```xml
<!-- Configuration file -->
<mapping>
    <class name="User" table="users">
        <property name="id" column="id"/>
        <property name="name" column="name"/>
        <property name="email" column="email"/>
    </class>
</mapping>
```

### With CoC (Convention-based)
```ruby
# Ruby on Rails - zero configuration needed
class User < ApplicationRecord
  # Automatically maps to 'users' table
  # Automatically maps id, name, email columns
end
```

**Benefit**: Default conventions eliminate configuration boilerplate
