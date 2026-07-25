import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './Breadcrumbs.css';

const Breadcrumbs = ({ items }) => {
    return (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol>
                <li>
                    <Link to="/">Home</Link>
                </li>
                {items.map((item, index) => (
                    <li key={index}>
                        <ChevronRight size={14} className="separator" />
                        {index === items.length - 1 ? (
                            <span aria-current="page">{item.label}</span>
                        ) : (
                            <Link to={item.path}>{item.label}</Link>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
