// Test file for interface expansion enhancement

/**
 * A person with various properties to test type expansion
 */
interface Person {
  id: number;
  name: string;
  age: number;
  email: string;
  address: {
    street: string;
    city: string;
    country: string;
  };
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

const person: Person = {
  id: 1,
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  address: {
    street: '123 Main St',
    city: 'New York',
    country: 'USA'
  },
  tags: ['developer', 'typescript'],
  isActive: true,
  createdAt: new Date(),
};

// Export to avoid unused variable warnings
export { person, Person };