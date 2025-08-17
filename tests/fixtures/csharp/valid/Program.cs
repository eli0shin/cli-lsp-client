namespace HelloWorld
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var message = "Hello, C# World!";
            Console.WriteLine(message);
            
            var numbers = new[] { 1, 2, 3, 4, 5 };
            var doubled = numbers.Select(x => x * 2).ToArray();
            
            Console.WriteLine("Original numbers: " + string.Join(", ", numbers));
            Console.WriteLine("Doubled numbers: " + string.Join(", ", doubled));
            
            // Create and use a simple class
            var person = new Person("Alice", 30);
            Console.WriteLine(person.GetIntroduction());
        }
    }
    
    public class Person
    {
        public string Name { get; set; }
        public int Age { get; set; }
        
        public Person(string name, int age)
        {
            Name = name;
            Age = age;
        }
        
        public string GetIntroduction()
        {
            return $"Hi, I'm {Name} and I'm {Age} years old.";
        }
    }
}