using System;

namespace SyntaxErrors
{
    public class BadClass
    {
        // Missing semicolon
        public string Name { get; set }
        
        // Invalid method declaration (missing return type)
        public Method()
        {
            return "something";
        }
        
        // Mismatched braces
        public void AnotherMethod()
        {
            if (true)
            {
                Console.WriteLine("test");
            // Missing closing brace
        }
        
        // Undefined variable
        public void UsingUndefinedVariable()
        {
            Console.WriteLine(undefinedVariable);
        }
        
        // Invalid syntax
        public void InvalidSyntax()
        {
            string message = "unclosed string;
            int number = abc;
        }
    // Missing closing brace for class