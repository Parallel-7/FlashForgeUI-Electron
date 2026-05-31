# SOLID Principles - Detailed Examples

## Single Responsibility Principle (SRP)

### Violation Example
```python
class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email
    
    def save_to_database(self):
        # Database logic
        pass
    
    def send_welcome_email(self):
        # Email logic
        pass
    
    def generate_report(self):
        # Reporting logic
        pass
```

**Problem**: User class has 3 reasons to change (data access, email, reporting)

### Correct Approach
```python
class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email

class UserRepository:
    def save(self, user):
        # Database logic
        pass

class EmailService:
    def send_welcome(self, user):
        # Email logic
        pass

class UserReportGenerator:
    def generate(self, user):
        # Reporting logic
        pass
```

**Benefit**: Each class has one responsibility, one reason to change

## Open/Closed Principle (OCP)

### Violation Example
```javascript
class PaymentProcessor {
    process(payment, type) {
        if (type === 'credit_card') {
            // Credit card logic
        } else if (type === 'paypal') {
            // PayPal logic
        } else if (type === 'bitcoin') {
            // Bitcoin logic - requires modifying existing code!
        }
    }
}
```

**Problem**: Adding new payment methods requires modifying PaymentProcessor

### Correct Approach
```javascript
interface PaymentMethod {
    process(amount): boolean;
}

class CreditCardPayment implements PaymentMethod {
    process(amount) {
        // Credit card logic
    }
}

class PayPalPayment implements PaymentMethod {
    process(amount) {
        // PayPal logic
    }
}

class BitcoinPayment implements PaymentMethod {
    process(amount) {
        // Bitcoin logic - new class, no modification needed!
    }
}

class PaymentProcessor {
    process(payment: PaymentMethod, amount) {
        return payment.process(amount);
    }
}
```

**Benefit**: Add new payment methods without touching existing code

## Liskov Substitution Principle (LSP)

### Violation Example
```python
class Bird:
    def fly(self):
        return "Flying"

class Penguin(Bird):
    def fly(self):
        raise Exception("Penguins can't fly!")
```

**Problem**: Penguin violates Bird contract - substitution breaks

### Correct Approach
```python
class Bird:
    def move(self):
        pass

class FlyingBird(Bird):
    def move(self):
        return "Flying"

class Penguin(Bird):
    def move(self):
        return "Swimming"

class Sparrow(FlyingBird):
    pass
```

**Benefit**: All birds can be used interchangeably without surprises

## Interface Segregation Principle (ISP)

### Violation Example
```java
interface Worker {
    void work();
    void eat();
    void sleep();
}

class Robot implements Worker {
    public void work() { /* work */ }
    public void eat() { throw new UnsupportedOperationException(); }  // Problem!
    public void sleep() { throw new UnsupportedOperationException(); }  // Problem!
}
```

**Problem**: Robot forced to implement methods it doesn't need

### Correct Approach
```java
interface Workable {
    void work();
}

interface Eatable {
    void eat();
}

interface Sleepable {
    void sleep();
}

class Human implements Workable, Eatable, Sleepable {
    public void work() { /* work */ }
    public void eat() { /* eat */ }
    public void sleep() { /* sleep */ }
}

class Robot implements Workable {
    public void work() { /* work */ }
}
```

**Benefit**: Clients only depend on methods they actually use

## Dependency Inversion Principle (DIP)

### Violation Example
```typescript
class MySQLDatabase {
    save(data: string) {
        // MySQL specific implementation
    }
}

class UserService {
    private db: MySQLDatabase;
    
    constructor() {
        this.db = new MySQLDatabase();  // Tight coupling!
    }
    
    saveUser(data: string) {
        this.db.save(data);
    }
}
```

**Problem**: UserService depends on concrete MySQLDatabase implementation

### Correct Approach
```typescript
interface Database {
    save(data: string): void;
}

class MySQLDatabase implements Database {
    save(data: string) {
        // MySQL implementation
    }
}

class PostgreSQLDatabase implements Database {
    save(data: string) {
        // PostgreSQL implementation
    }
}

class UserService {
    private db: Database;
    
    constructor(db: Database) {  // Dependency injection
        this.db = db;
    }
    
    saveUser(data: string) {
        this.db.save(data);
    }
}

// Usage
const userService = new UserService(new MySQLDatabase());
// Easy to swap: new UserService(new PostgreSQLDatabase());
```

**Benefit**: UserService doesn't depend on concrete database - easy to swap implementations
