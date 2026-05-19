import { Link } from 'react-router-dom';
import { paths } from '@/config/paths';

const NotFoundRoute = () => {
  return (
    <div className="mt-52 flex flex-col items-center font-semibold space-y-4">
      <h1 className="text-4xl">404 - Not Found</h1>
      <p className="text-lg text-gray-600">Sorry, the page you are looking for does not exist.</p>
      <Link
        to={paths.home.getHref()}
        replace
        className="text-blue-600 hover:text-blue-800 underline"
      >
        Go to Home
      </Link>
    </div>
  );
};

export default NotFoundRoute;