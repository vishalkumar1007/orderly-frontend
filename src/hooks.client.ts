import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ message }) => {
	return { message: message || 'Something went wrong' };
};
