package com.example;

public class SyntaxError {
    private String message;
    
    // Missing semicolon
    public static void main(String[] args)
        System.out.println("Hello")
        
        // Undefined variable
        System.out.println(undefinedVariable);
        
        // Wrong type assignment
        int number = "not a number";
        
        // Missing closing brace
        if (true) {
            System.out.println("Test");
        // Missing closing brace
        
        // Calling non-existent method
        nonExistentMethod();
    }
    
    public void brokenMethod() {
        // Return type mismatch
        return "string"; // Should return void
    }
    
    // Missing closing brace for class