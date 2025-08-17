namespace Calculator
{
    public class Calculator
    {
        public double Add(double a, double b)
        {
            return a + b;
        }
        
        public double Subtract(double a, double b)
        {
            return a - b;
        }
        
        public double Multiply(double a, double b)
        {
            return a * b;
        }
        
        public double Divide(double a, double b)
        {
            if (b == 0)
            {
                throw new System.ArgumentException("Cannot divide by zero");
            }
            return a / b;
        }
        
        public double Power(double baseValue, double exponent)
        {
            return System.Math.Pow(baseValue, exponent);
        }
    }
}