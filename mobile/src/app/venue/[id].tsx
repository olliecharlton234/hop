import { Redirect, useLocalSearchParams } from 'expo-router';
/** Shared link /venue/<id> → the venue sheet on the map */
export default function VenueLink() { const { id } = useLocalSearchParams<{ id: string }>(); return <Redirect href={{ pathname: '/', params: { venue: id } }} />; }
