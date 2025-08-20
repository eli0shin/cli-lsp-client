package complextypes

import (
	"time"
)

// User represents a user with various fields for testing struct expansion
type User struct {
	ID        int
	Name      string
	Email     string
	Age       int
	Active    bool
	CreatedAt time.Time
	Tags      []string
	Metadata  map[string]interface{}
	Address   Address
}

// Address represents a nested struct
type Address struct {
	Street  string
	City    string
	Country string
	ZipCode string
}

// NewUser creates a new user instance
func NewUser(name string, email string) *User {
	return &User{
		Name:      name,
		Email:     email,
		Active:    true,
		CreatedAt: time.Now(),
		Tags:      []string{},
		Metadata:  make(map[string]interface{}),
	}
}

// AddTag adds a tag to the user
func (u *User) AddTag(tag string) {
	u.Tags = append(u.Tags, tag)
}

// SetAddress sets the user's address
func (u *User) SetAddress(street, city, country, zipCode string) {
	u.Address = Address{
		Street:  street,
		City:    city,
		Country: country,
		ZipCode: zipCode,
	}
}

// ServerConfig represents a complex configuration structure
type ServerConfig struct {
	Host string
	Port int
	SSL  bool
	Database struct {
		Host     string
		Port     int
		Name     string
		User     string
		Password string
	}
	Cache struct {
		Enabled bool
		TTL     int
		MaxSize int
	}
	Endpoints  []string
	Middleware []MiddlewareConfig
}

// MiddlewareConfig represents middleware configuration
type MiddlewareConfig struct {
	Name    string
	Enabled bool
	Options map[string]string
}

// Example usage
var (
	defaultUser = User{
		ID:    1,
		Name:  "John Doe",
		Email: "john@example.com",
		Age:   30,
	}

	config = ServerConfig{
		Host: "localhost",
		Port: 8080,
		SSL:  false,
	}
)