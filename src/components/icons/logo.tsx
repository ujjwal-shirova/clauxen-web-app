export function Logo() {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
      >
        <path
          d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
          fill="hsl(var(--primary))"
        />
        <path
          d="M12 12L22 7L12 2L2 7L12 12Z"
          fill="white"
          fillOpacity="0.5"
        />
      </svg>
    );
  }
  