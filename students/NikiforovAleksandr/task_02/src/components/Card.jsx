const Card = ({ children, className = '', hover = true }) => {
  return (
    <div className={`
      bg-white dark:bg-gray-800 
      rounded-xl shadow-sm 
      border border-gray-200 dark:border-gray-700
      transition-all duration-300
      ${hover ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

export const CardBody = ({ children, className = '' }) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

export default Card