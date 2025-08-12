package main

import "fmt"

func main() {
	var x int = "hello world" // Type error: string assigned to int
	fmt.Println(x)
}